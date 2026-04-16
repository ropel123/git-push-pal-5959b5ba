// fetch-dce-agent: Orchestrateur Browserbase + Stagehand-like (LLM-driven) + 2Captcha
// Récupère automatiquement les DCE sur des plateformes nécessitant login/captcha.
//
// Flow:
//   1. Identifier la plateforme à partir de dce_url
//   2. Charger le playbook (steps en langage naturel) depuis agent_playbooks
//   3. Créer une session Browserbase (Chrome cloud avec IPs résidentielles)
//   4. Exécuter chaque étape via la Browserbase Sessions API + Stagehand-like cdp commands
//   5. Si captcha détecté, le résoudre via 2Captcha
//   6. Télécharger le DCE → uploader dans le bucket dce-documents
//   7. Logger le run dans agent_runs

import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BROWSERBASE_API_KEY = Deno.env.get("BROWSERBASE_API_KEY")!;
const BROWSERBASE_PROJECT_ID = Deno.env.get("BROWSERBASE_PROJECT_ID")!;
const TWOCAPTCHA_API_KEY = Deno.env.get("TWOCAPTCHA_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface PlaybookStep {
  action: string;
  natural?: string;
  target?: string;
  use_robot?: boolean;
  timeout_ms?: number;
}

interface RunTrace {
  ts: string;
  step: string;
  status: "ok" | "skipped" | "failed";
  detail?: string;
}

const trace: RunTrace[] = [];
const log = (step: string, status: "ok" | "skipped" | "failed", detail?: string) => {
  trace.push({ ts: new Date().toISOString(), step, status, detail });
  console.log(`[agent] ${status.toUpperCase()} ${step}${detail ? ` — ${detail}` : ""}`);
};

// --- Browserbase helpers ---

async function createBrowserbaseSession(): Promise<string> {
  const res = await fetch("https://api.browserbase.com/v1/sessions", {
    method: "POST",
    headers: {
      "X-BB-API-Key": BROWSERBASE_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId: BROWSERBASE_PROJECT_ID,
      browserSettings: {
        viewport: { width: 1280, height: 800 },
        solveCaptchas: true, // Browserbase a un solveur natif (gratuit pour reCAPTCHA basique)
      },
      keepAlive: false,
      timeout: 600,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Browserbase session creation failed [${res.status}]: ${txt}`);
  }
  const data = await res.json();
  log("browserbase.create_session", "ok", `session=${data.id}`);
  return data.id;
}

async function endBrowserbaseSession(sessionId: string) {
  try {
    await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}`, {
      method: "POST",
      headers: { "X-BB-API-Key": BROWSERBASE_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: BROWSERBASE_PROJECT_ID, status: "REQUEST_RELEASE" }),
    });
  } catch (_) {
    // best-effort
  }
}

async function getDownloads(sessionId: string): Promise<{ name: string; url: string }[]> {
  // Browserbase expose les fichiers téléchargés pendant la session
  const res = await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}/downloads`, {
    headers: { "X-BB-API-Key": BROWSERBASE_API_KEY },
  });
  if (!res.ok) return [];
  const data = await res.json();
  // L'API renvoie un ZIP combiné. On le récupère directement via le endpoint downloads.
  return Array.isArray(data) ? data : [];
}

async function downloadSessionArchive(sessionId: string): Promise<Uint8Array | null> {
  const res = await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}/downloads`, {
    headers: { "X-BB-API-Key": BROWSERBASE_API_KEY, Accept: "application/zip" },
  });
  if (!res.ok) {
    log("browserbase.download_archive", "failed", `status=${res.status}`);
    return null;
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength < 100) return null; // ZIP vide
  return buf;
}

// --- 2Captcha helpers ---

async function solveRecaptcha(siteKey: string, pageUrl: string): Promise<string> {
  const submit = await fetch(
    `https://2captcha.com/in.php?key=${TWOCAPTCHA_API_KEY}&method=userrecaptcha&googlekey=${siteKey}&pageurl=${encodeURIComponent(pageUrl)}&json=1`,
  );
  const submitData = await submit.json();
  if (submitData.status !== 1) throw new Error(`2Captcha submit failed: ${submitData.request}`);
  const requestId = submitData.request;

  // Poll for result
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const poll = await fetch(
      `https://2captcha.com/res.php?key=${TWOCAPTCHA_API_KEY}&action=get&id=${requestId}&json=1`,
    );
    const pollData = await poll.json();
    if (pollData.status === 1) return pollData.request;
    if (pollData.request !== "CAPCHA_NOT_READY") {
      throw new Error(`2Captcha poll failed: ${pollData.request}`);
    }
  }
  throw new Error("2Captcha timeout (150s)");
}

// --- Platform detection ---

function detectPlatform(url: string): string {
  if (/achatpublic\.com/i.test(url)) return "atexo_achatpublic";
  if (/local-trust\.com/i.test(url)) return "atexo_localtrust";
  if (/marches-securises\.fr/i.test(url)) return "marches_securises";
  if (/maximilien\.fr/i.test(url)) return "maximilien";
  if (/place\.marches-publics\.gouv\.fr/i.test(url)) return "place";
  if (/megalis\.bretagne\.bzh/i.test(url)) return "megalis";
  return "unknown";
}

// --- Main handler ---

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const startedAt = Date.now();
  let runId: string | null = null;
  let sessionId: string | null = null;

  try {
    const body = await req.json();
    const { tender_id, dce_url, triggered_by } = body;

    if (!tender_id || !dce_url) {
      return new Response(JSON.stringify({ error: "tender_id and dce_url required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const platform = detectPlatform(dce_url);
    log("router.detect_platform", "ok", platform);

    // Créer le run (status pending)
    const { data: runRow, error: runErr } = await supabase
      .from("agent_runs")
      .insert({
        tender_id,
        platform,
        dce_url,
        status: "running",
        triggered_by: triggered_by ?? null,
      })
      .select("id")
      .single();
    if (runErr) throw new Error(`agent_runs insert: ${runErr.message}`);
    runId = runRow.id;

    // Charger playbook
    const { data: playbook } = await supabase
      .from("agent_playbooks")
      .select("*")
      .eq("platform", platform)
      .eq("is_active", true)
      .maybeSingle();

    if (!playbook) {
      throw new Error(`Aucun playbook actif pour la plateforme "${platform}". Créez-en un dans /agent-monitor.`);
    }
    log("playbook.load", "ok", playbook.display_name);

    // Charger credentials robot si nécessaire
    let robot: { login: string; password_encrypted: string } | null = null;
    if (playbook.requires_auth) {
      const { data: r } = await supabase
        .from("platform_robots")
        .select("login,password_encrypted")
        .eq("platform", platform)
        .eq("is_active", true)
        .maybeSingle();
      if (!r) throw new Error(`Aucun compte robot actif pour ${platform}. Configurez-en un dans /agent-monitor.`);
      robot = r;
      log("robot.load", "ok", r.login);
    }

    // Créer session Browserbase
    sessionId = await createBrowserbaseSession();

    // Exécuter les steps via Browserbase Sessions API (cdp/act endpoint)
    // Note: pour la V1, on utilise l'endpoint "sessions/{id}/act" si disponible,
    // sinon on délègue à Stagehand via le SDK officiel.
    // Ici on simule un parcours simple en utilisant l'API CDP minimale.
    const steps = (playbook.steps as PlaybookStep[]) ?? [];
    let captchasSolved = 0;

    for (const step of steps) {
      const stepLabel = `${step.action}${step.natural ? `("${step.natural}")` : ""}`;
      try {
        switch (step.action) {
          case "navigate": {
            const target = (step.target ?? "").replace("{{dce_url}}", dce_url);
            await browserbaseAct(sessionId, { type: "goto", url: target });
            log(stepLabel, "ok", target);
            break;
          }
          case "click":
          case "click_if_present": {
            const r = await browserbaseAct(sessionId, {
              type: "act",
              instruction: `Clique sur l'élément correspondant à : ${step.natural}`,
              tolerateMissing: step.action === "click_if_present",
            });
            log(stepLabel, r.found ? "ok" : "skipped");
            break;
          }
          case "fill_login": {
            if (!robot) throw new Error("fill_login mais aucun robot chargé");
            await browserbaseAct(sessionId, {
              type: "act",
              instruction: `Trouve le champ login/email et saisis "${robot.login}", puis le champ mot de passe et saisis "${robot.password_encrypted}", puis clique sur le bouton de connexion.`,
            });
            log(stepLabel, "ok", `as ${robot.login}`);
            break;
          }
          case "solve_captcha_if_present": {
            const captcha = await browserbaseAct(sessionId, { type: "detect_captcha" });
            if (captcha.found && captcha.siteKey && captcha.pageUrl) {
              const token = await solveRecaptcha(captcha.siteKey, captcha.pageUrl);
              await browserbaseAct(sessionId, { type: "inject_recaptcha_token", token });
              captchasSolved++;
              log(stepLabel, "ok", "reCAPTCHA résolu");
            } else {
              log(stepLabel, "skipped", "aucun captcha");
            }
            break;
          }
          case "wait_download": {
            await new Promise((r) => setTimeout(r, step.timeout_ms ?? 30000));
            log(stepLabel, "ok");
            break;
          }
          default:
            log(stepLabel, "skipped", "action inconnue");
        }
      } catch (e: any) {
        log(stepLabel, "failed", e.message);
        throw e;
      }
    }

    // Récupérer les fichiers téléchargés
    const archive = await downloadSessionArchive(sessionId);
    let filesUploaded = 0;
    if (archive) {
      const filename = `${tender_id}/agent_${Date.now()}.zip`;
      const { error: upErr } = await supabase.storage
        .from("dce-documents")
        .upload(filename, archive, { contentType: "application/zip", upsert: true });
      if (upErr) throw new Error(`Storage upload: ${upErr.message}`);
      log("storage.upload", "ok", filename);

      // Ouvrir une entrée dce_uploads (user_id = triggered_by ou bucket système)
      if (triggered_by) {
        await supabase.from("dce_uploads").insert({
          tender_id,
          user_id: triggered_by,
          file_name: `DCE_agent_${platform}.zip`,
          file_path: filename,
          file_size: archive.byteLength,
        });
      }
      filesUploaded = 1;
    }

    // Compter les coûts approximatifs
    const durationMs = Date.now() - startedAt;
    const costUsd = 0.10 + captchasSolved * 0.003 + 0.01; // browserbase + 2captcha + LLM

    await supabase
      .from("agent_runs")
      .update({
        status: filesUploaded > 0 ? "success" : "no_files",
        finished_at: new Date().toISOString(),
        duration_ms: durationMs,
        cost_usd: costUsd,
        captchas_solved: captchasSolved,
        files_downloaded: filesUploaded,
        browserbase_session_id: sessionId,
        trace: trace as any,
      })
      .eq("id", runId);

    // Stats robot
    if (robot) {
      await supabase.rpc("increment", {}); // placeholder; sinon manual update
      await supabase
        .from("platform_robots")
        .update({
          last_used_at: new Date().toISOString(),
          success_count: filesUploaded > 0 ? 1 : 0,
        })
        .eq("platform", platform);
    }

    await endBrowserbaseSession(sessionId);

    return new Response(
      JSON.stringify({
        success: true,
        run_id: runId,
        files_uploaded: filesUploaded,
        captchas_solved: captchasSolved,
        duration_ms: durationMs,
        cost_usd: costUsd,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[agent] FATAL", err);
    if (sessionId) await endBrowserbaseSession(sessionId);
    if (runId) {
      await supabase
        .from("agent_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startedAt,
          error_message: err.message,
          trace: trace as any,
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

// --- Browserbase "act" abstraction ---
// Browserbase n'expose pas (encore) un endpoint "act" universel via REST.
// Pour la V1 nous utilisons CDP via WebSocket pour les actions basiques,
// et déléguons les actions complexes ("click on natural language target")
// à un appel LLM qui retourne un sélecteur CSS, puis exécute le click via CDP.
// Cette implémentation est une stub structurelle — elle log le step et retourne
// un résultat simulé. Le vrai pilotage sera ajouté en branchant @browserbasehq/stagehand
// ou Playwright-over-CDP côté edge function (nécessite Deno + WS support).

async function browserbaseAct(
  sessionId: string,
  payload: any,
): Promise<{ found: boolean; siteKey?: string; pageUrl?: string }> {
  // STUB: à remplacer par l'intégration Stagehand/CDP réelle.
  // Pour l'instant on retourne un succès pour permettre de tester le pipeline DB + storage.
  console.log(`[browserbaseAct] session=${sessionId}`, JSON.stringify(payload).slice(0, 200));
  await new Promise((r) => setTimeout(r, 500));
  if (payload.type === "detect_captcha") return { found: false };
  return { found: true };
}
