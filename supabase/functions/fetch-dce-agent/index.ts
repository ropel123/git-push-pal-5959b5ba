// fetch-dce-agent: Orchestrateur Browserbase + Stagehand + 2Captcha
// Pilote un Chromium cloud pour récupérer automatiquement les DCE sur des plateformes
// nécessitant login et/ou captcha (Atexo, Marchés-Sécurisés, Maximilien, PLACE…).
//
// Architecture :
//   1. Détection de la plateforme à partir de l'URL DCE
//   2. Chargement du playbook (suite d'actions en langage naturel) depuis agent_playbooks
//   3. Création d'une session Browserbase + connexion Stagehand (LLM-driven)
//   4. Exécution des étapes : goto / act / extract / fill_login / solve_captcha / download
//   5. Récupération de l'archive de téléchargements Browserbase → bucket dce-documents
//   6. Persistance complète du run + trace structurée dans agent_runs

import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { Stagehand } from "https://esm.sh/@browserbasehq/stagehand@1.14.0?bundle&target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BROWSERBASE_API_KEY = Deno.env.get("BROWSERBASE_API_KEY")!;
const BROWSERBASE_PROJECT_ID = Deno.env.get("BROWSERBASE_PROJECT_ID")!;
const TWOCAPTCHA_API_KEY = Deno.env.get("TWOCAPTCHA_API_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const HARD_TIMEOUT_MS = 90_000;

interface PlaybookStep {
  action: string;
  instruction?: string;
  natural?: string;
  target?: string;
  type?: string;
  use_robot?: boolean;
  timeout_ms?: number;
  timeout?: number;
}

interface RunTrace {
  ts: string;
  step: string;
  status: "ok" | "skipped" | "failed";
  duration_ms?: number;
  detail?: string;
}

// --- 2Captcha (reCAPTCHA v2) ---

async function solveRecaptchaV2(siteKey: string, pageUrl: string): Promise<string> {
  const submit = await fetch(
    `https://2captcha.com/in.php?key=${TWOCAPTCHA_API_KEY}&method=userrecaptcha&googlekey=${siteKey}&pageurl=${encodeURIComponent(pageUrl)}&json=1`,
  );
  const submitData = await submit.json();
  if (submitData.status !== 1) throw new Error(`2Captcha submit: ${submitData.request}`);
  const id = submitData.request;

  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const poll = await fetch(
      `https://2captcha.com/res.php?key=${TWOCAPTCHA_API_KEY}&action=get&id=${id}&json=1`,
    );
    const pollData = await poll.json();
    if (pollData.status === 1) return pollData.request as string;
    if (pollData.request !== "CAPCHA_NOT_READY") {
      throw new Error(`2Captcha poll: ${pollData.request}`);
    }
  }
  throw new Error("2Captcha timeout (120s)");
}

// --- Browserbase downloads archive ---

async function downloadSessionArchive(sessionId: string): Promise<Uint8Array | null> {
  const res = await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}/downloads`, {
    headers: { "X-BB-API-Key": BROWSERBASE_API_KEY, Accept: "application/zip" },
  });
  if (!res.ok) return null;
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength < 100) return null;
  return buf;
}

// --- Platform detection ---

function detectPlatform(url: string): string {
  if (/place\.marches-publics\.gouv\.fr/i.test(url)) return "place";
  if (/achatpublic\.com/i.test(url)) return "atexo_achatpublic";
  if (/local-trust\.com/i.test(url)) return "atexo_localtrust";
  if (/marches-securises\.fr/i.test(url)) return "marches_securises";
  if (/maximilien\.fr/i.test(url)) return "maximilien";
  if (/megalis\.bretagne\.bzh/i.test(url)) return "megalis";
  return "unknown";
}

// --- Captcha detection helper (sitekey reCAPTCHA v2) ---

async function detectRecaptchaSiteKey(stagehand: any): Promise<string | null> {
  try {
    const result = await stagehand.page.evaluate(() => {
      const el = document.querySelector("[data-sitekey]") as HTMLElement | null;
      return el?.getAttribute("data-sitekey") ?? null;
    });
    return result ?? null;
  } catch {
    return null;
  }
}

async function injectRecaptchaToken(stagehand: any, token: string): Promise<void> {
  await stagehand.page.evaluate((t: string) => {
    const ta = document.querySelector('textarea[name="g-recaptcha-response"]') as HTMLTextAreaElement | null;
    if (ta) {
      ta.style.display = "block";
      ta.value = t;
      ta.dispatchEvent(new Event("change", { bubbles: true }));
    }
    // Trigger any callback registered with grecaptcha
    // @ts-ignore
    if (typeof window.___grecaptcha_cfg !== "undefined") {
      // @ts-ignore
      const clients = window.___grecaptcha_cfg.clients ?? {};
      Object.keys(clients).forEach((cid) => {
        const c = clients[cid];
        Object.keys(c).forEach((k) => {
          const obj = c[k];
          if (obj && typeof obj === "object") {
            Object.keys(obj).forEach((kk) => {
              const inner = obj[kk];
              if (inner && typeof inner === "object" && typeof inner.callback === "function") {
                try { inner.callback(t); } catch (_) {}
              }
            });
          }
        });
      });
    }
  }, token);
}

// --- Main handler ---

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const startedAt = Date.now();
  const trace: RunTrace[] = [];
  let runId: string | null = null;
  let sessionId: string | null = null;
  let stagehand: any = null;
  let captchasSolved = 0;

  const log = (step: string, status: "ok" | "skipped" | "failed", detail?: string, duration_ms?: number) => {
    trace.push({ ts: new Date().toISOString(), step, status, duration_ms, detail });
    console.log(`[agent] ${status.toUpperCase()} ${step}${detail ? ` — ${detail}` : ""}`);
  };

  const hardTimeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Wallclock timeout (${HARD_TIMEOUT_MS}ms)`)), HARD_TIMEOUT_MS),
  );

  const runMain = async () => {
    const body = await req.json();
    const { tender_id, dce_url, triggered_by } = body;
    if (!tender_id || !dce_url) throw new Error("tender_id and dce_url required");

    const platform = detectPlatform(dce_url);
    log("router.detect_platform", "ok", platform);

    // Insert run row
    const { data: runRow, error: runErr } = await supabase
      .from("agent_runs")
      .insert({ tender_id, platform, dce_url, status: "running", triggered_by: triggered_by ?? null })
      .select("id")
      .single();
    if (runErr) throw new Error(`agent_runs insert: ${runErr.message}`);
    runId = runRow.id;

    // Load playbook
    const { data: playbook } = await supabase
      .from("agent_playbooks")
      .select("*")
      .eq("platform", platform)
      .eq("is_active", true)
      .maybeSingle();
    if (!playbook) throw new Error(`Aucun playbook actif pour "${platform}".`);
    log("playbook.load", "ok", playbook.display_name);

    // Load robot (optional fallback for restricted procedures)
    let robot: { login: string; password_encrypted: string } | null = null;
    {
      const { data: r } = await supabase
        .from("platform_robots")
        .select("login,password_encrypted")
        .eq("platform", platform)
        .eq("is_active", true)
        .maybeSingle();
      if (r) {
        robot = r;
        log("robot.load", "ok", r.login);
      } else if (playbook.requires_auth) {
        log("robot.load", "skipped", "aucun compte — fallback identité anonyme");
      }
    }

    // Load default anonymous identity (used by fill_anonymous_identity)
    const { data: anonId } = await supabase
      .from("agent_anonymous_identity")
      .select("email,company_name,siret,last_name,first_name,phone")
      .eq("is_default", true)
      .maybeSingle();
    if (anonId) log("identity.load", "ok", anonId.email);

    // Init Stagehand (Browserbase env)
    const tInit = Date.now();
    stagehand = new Stagehand({
      env: "BROWSERBASE",
      apiKey: BROWSERBASE_API_KEY,
      projectId: BROWSERBASE_PROJECT_ID,
      modelName: "anthropic/claude-3-5-sonnet-latest",
      modelClientOptions: {
        apiKey: OPENROUTER_API_KEY,
        baseURL: "https://openrouter.ai/api/v1",
      },
      browserbaseSessionCreateParams: {
        projectId: BROWSERBASE_PROJECT_ID,
        browserSettings: {
          viewport: { width: 1280, height: 800 },
          solveCaptchas: false, // on gère via 2Captcha pour fiabilité
        },
      },
      verbose: 1,
    });

    await stagehand.init();
    sessionId = stagehand.browserbaseSessionID ?? null;
    log("stagehand.init", "ok", `session=${sessionId}`, Date.now() - tInit);

    const steps = (playbook.steps as PlaybookStep[]) ?? [];

    for (const step of steps) {
      const stepStart = Date.now();
      const label = `${step.action}${step.instruction ? `("${step.instruction.slice(0, 60)}")` : step.natural ? `("${step.natural}")` : ""}`;
      try {
        switch (step.action) {
          case "goto":
          case "navigate": {
            const target = (step.target ?? "").replace("{{dce_url}}", dce_url);
            await stagehand.page.goto(target || dce_url, { waitUntil: "domcontentloaded", timeout: 30000 });
            log(label, "ok", target || dce_url, Date.now() - stepStart);
            break;
          }
          case "act":
          case "click":
          case "click_if_present": {
            const instruction = step.instruction ?? step.natural ?? "";
            try {
              await stagehand.page.act({ action: instruction });
              log(label, "ok", undefined, Date.now() - stepStart);
            } catch (e: any) {
              if (step.action === "click_if_present") {
                log(label, "skipped", e.message, Date.now() - stepStart);
              } else {
                throw e;
              }
            }
            break;
          }
          case "fill_login": {
            if (!robot) throw new Error("fill_login sans robot");
            await stagehand.page.act({
              action: `Trouve le champ identifiant/email et saisis exactement "${robot.login}", puis le champ mot de passe et saisis exactement "${robot.password_encrypted}", puis valide le formulaire de connexion.`,
            });
            log(label, "ok", `as ${robot.login}`, Date.now() - stepStart);
            break;
          }
          case "solve_captcha":
          case "solve_captcha_if_present": {
            const siteKey = await detectRecaptchaSiteKey(stagehand);
            if (!siteKey) {
              if (step.action === "solve_captcha_if_present") {
                log(label, "skipped", "aucun captcha détecté", Date.now() - stepStart);
                break;
              }
              throw new Error("Aucun reCAPTCHA détecté (sitekey introuvable)");
            }
            const pageUrl = stagehand.page.url();
            const token = await solveRecaptchaV2(siteKey, pageUrl);
            await injectRecaptchaToken(stagehand, token);
            captchasSolved++;
            log(label, "ok", `sitekey=${siteKey.slice(0, 12)}…`, Date.now() - stepStart);
            break;
          }
          case "wait": {
            await new Promise((r) => setTimeout(r, step.timeout_ms ?? 3000));
            log(label, "ok", undefined, Date.now() - stepStart);
            break;
          }
          case "download":
          case "wait_download": {
            // Le téléchargement est déjà déclenché par l'étape précédente.
            // On laisse Browserbase capter le fichier.
            await new Promise((r) => setTimeout(r, step.timeout_ms ?? step.timeout ?? 20000));
            log(label, "ok", undefined, Date.now() - stepStart);
            break;
          }
          default:
            log(label, "skipped", "action inconnue", Date.now() - stepStart);
        }
      } catch (e: any) {
        log(label, "failed", e.message, Date.now() - stepStart);
        throw e;
      }
    }

    // Récupérer fichiers téléchargés (archive ZIP Browserbase)
    let filesUploaded = 0;
    let archiveSize = 0;
    if (sessionId) {
      const archive = await downloadSessionArchive(sessionId);
      if (archive) {
        archiveSize = archive.byteLength;
        const filename = `${tender_id}/agent_${Date.now()}.zip`;
        const { error: upErr } = await supabase.storage
          .from("dce-documents")
          .upload(filename, archive, { contentType: "application/zip", upsert: true });
        if (upErr) throw new Error(`Storage upload: ${upErr.message}`);
        log("storage.upload", "ok", `${filename} (${archiveSize} B)`);

        if (triggered_by) {
          await supabase.from("dce_uploads").insert({
            tender_id,
            user_id: triggered_by,
            file_name: `DCE_agent_${platform}.zip`,
            file_path: filename,
            file_size: archiveSize,
          });
        }
        filesUploaded = 1;
      } else {
        log("storage.upload", "skipped", "aucune archive de téléchargements");
      }
    }

    const durationMs = Date.now() - startedAt;
    const browserbaseMin = durationMs / 60000;
    const costUsd = browserbaseMin * 0.10 + captchasSolved * 0.003 + 0.01;

    await supabase
      .from("agent_runs")
      .update({
        status: filesUploaded > 0 ? "success" : "no_files",
        finished_at: new Date().toISOString(),
        duration_ms: durationMs,
        cost_usd: Number(costUsd.toFixed(4)),
        captchas_solved: captchasSolved,
        files_downloaded: filesUploaded,
        browserbase_session_id: sessionId,
        trace: trace as any,
      })
      .eq("id", runId!);

    if (robot) {
      await supabase
        .from("platform_robots")
        .update({ last_used_at: new Date().toISOString() })
        .eq("platform", platform);
    }

    return {
      success: true,
      run_id: runId,
      files_uploaded: filesUploaded,
      captchas_solved: captchasSolved,
      duration_ms: durationMs,
      cost_usd: Number(costUsd.toFixed(4)),
    };
  };

  try {
    const result = await Promise.race([runMain(), hardTimeout]);
    if (stagehand) await stagehand.close().catch(() => {});
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[agent] FATAL", err);
    if (stagehand) await stagehand.close().catch(() => {});
    if (runId) {
      const isTimeout = /timeout/i.test(err.message);
      await supabase
        .from("agent_runs")
        .update({
          status: isTimeout ? "timeout" : "failed",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startedAt,
          error_message: err.message,
          trace: trace as any,
          captchas_solved: captchasSolved,
          browserbase_session_id: sessionId,
        })
        .eq("id", runId);
    }
    return new Response(
      JSON.stringify({ success: false, error: err.message, run_id: runId, trace }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
