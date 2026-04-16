// fetch-dce-agent — Browserbase REST + Chrome DevTools Protocol (CDP) over WebSocket
// Pas de Playwright/Stagehand : 100% Deno-native, compatible edge runtime.

import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BROWSERBASE_API_KEY = Deno.env.get("BROWSERBASE_API_KEY")!;
const BROWSERBASE_PROJECT_ID = Deno.env.get("BROWSERBASE_PROJECT_ID")!;
const TWOCAPTCHA_API_KEY = Deno.env.get("TWOCAPTCHA_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const HARD_TIMEOUT_MS = 110_000;

interface PlaybookStep {
  action: string;
  instruction?: string;
  natural?: string;
  target?: string;
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

// ---------- Browserbase Sessions API ----------

async function createBrowserbaseSession(): Promise<{ id: string; connectUrl: string }> {
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
        solveCaptchas: false,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Browserbase session create ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  return { id: data.id, connectUrl: data.connectUrl };
}

async function downloadSessionArchive(sessionId: string): Promise<Uint8Array | null> {
  const res = await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}/downloads`, {
    headers: { "X-BB-API-Key": BROWSERBASE_API_KEY, Accept: "application/zip" },
  });
  if (!res.ok) return null;
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength < 100) return null;
  return buf;
}

async function closeBrowserbaseSession(sessionId: string): Promise<void> {
  try {
    await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}`, {
      method: "POST",
      headers: { "X-BB-API-Key": BROWSERBASE_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: BROWSERBASE_PROJECT_ID, status: "REQUEST_RELEASE" }),
    });
  } catch (_) { /* noop */ }
}

// ---------- Minimal CDP client over WebSocket ----------

class CDP {
  private ws: WebSocket;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();
  private sessions = new Map<string, string>(); // targetId -> sessionId
  public defaultSessionId: string | null = null;

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
        if (msg.id && this.pending.has(msg.id)) {
          const p = this.pending.get(msg.id)!;
          this.pending.delete(msg.id);
          if (msg.error) p.reject(new Error(`CDP error: ${msg.error.message ?? JSON.stringify(msg.error)}`));
          else p.resolve(msg.result);
        }
      } catch (_) { /* ignore */ }
    };
  }

  static async connect(url: string): Promise<CDP> {
    const ws = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("CDP WS connect timeout")), 20_000);
      ws.onopen = () => { clearTimeout(t); resolve(); };
      ws.onerror = (e) => { clearTimeout(t); reject(new Error(`CDP WS error: ${(e as any).message ?? "unknown"}`)); };
    });
    return new CDP(ws);
  }

  send(method: string, params: any = {}, sessionId?: string): Promise<any> {
    const id = this.nextId++;
    const payload: any = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        this.ws.send(JSON.stringify(payload));
      } catch (e) {
        this.pending.delete(id);
        reject(e);
      }
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 30_000);
    });
  }

  async attachToFirstPage(): Promise<string> {
    const { targetInfos } = await this.send("Target.getTargets");
    const page = targetInfos.find((t: any) => t.type === "page") ?? targetInfos[0];
    if (!page) throw new Error("Aucune target page disponible");
    const { sessionId } = await this.send("Target.attachToTarget", {
      targetId: page.targetId,
      flatten: true,
    });
    this.defaultSessionId = sessionId;
    this.sessions.set(page.targetId, sessionId);
    // Enable common domains
    await this.send("Page.enable", {}, sessionId);
    await this.send("Runtime.enable", {}, sessionId);
    await this.send("Network.enable", {}, sessionId);
    return sessionId;
  }

  async navigate(url: string): Promise<void> {
    if (!this.defaultSessionId) throw new Error("CDP not attached");
    await this.send("Page.navigate", { url }, this.defaultSessionId);
    // Wait for DOMContentLoaded-ish
    await new Promise((r) => setTimeout(r, 2000));
  }

  async eval(expression: string): Promise<any> {
    if (!this.defaultSessionId) throw new Error("CDP not attached");
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    }, this.defaultSessionId);
    if (res.exceptionDetails) {
      throw new Error(`JS exception: ${res.exceptionDetails.text ?? res.exceptionDetails.exception?.description ?? "unknown"}`);
    }
    return res.result?.value;
  }

  async url(): Promise<string> {
    return await this.eval("location.href");
  }

  close() {
    try { this.ws.close(); } catch (_) { /* noop */ }
  }
}

// ---------- DOM heuristics injected as JS ----------

function jsClickByText(instruction: string): string {
  // Build candidate keywords from instruction
  const safe = JSON.stringify(instruction);
  return `
(() => {
  const instruction = ${safe}.toLowerCase();
  // Extract candidate phrases : split on commas, parentheses, colons
  const raw = instruction
    .replace(/[()\\[\\]]/g, ",")
    .split(/[,;:]/)
    .map(s => s.trim())
    .filter(s => s.length >= 3 && s.length < 80);
  const phrases = raw.length ? raw : [instruction];

  const isVisible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const st = window.getComputedStyle(el);
    return st.visibility !== "hidden" && st.display !== "none" && st.opacity !== "0";
  };

  const candidates = Array.from(document.querySelectorAll(
    'a, button, input[type=submit], input[type=button], [role=button], [onclick]'
  ));

  // Score each candidate by phrase match
  let best = null;
  let bestScore = 0;
  for (const el of candidates) {
    if (!isVisible(el)) continue;
    const text = (el.innerText || el.value || el.getAttribute('aria-label') || el.title || '').toLowerCase().trim();
    if (!text) continue;
    for (const p of phrases) {
      if (text.includes(p)) {
        const score = p.length;
        if (score > bestScore) { best = el; bestScore = score; }
      }
    }
  }

  if (!best) return { clicked: false, reason: "no match" };
  best.scrollIntoView({ block: "center" });
  best.click();
  return { clicked: true, text: (best.innerText || best.value || '').slice(0, 80) };
})()
`;
}

function jsFillIdentity(identity: Record<string, string>): string {
  const safe = JSON.stringify(identity);
  return `
(() => {
  const id = ${safe};
  const fieldMap = [
    { keys: ['email','mail','courriel','e-mail'], value: id.email },
    { keys: ['raison','societe','société','company','entreprise','organisation'], value: id.company_name },
    { keys: ['siret','siren'], value: id.siret || '' },
    { keys: ['nom','lastname','last_name','last-name'], value: id.last_name, exclude: ['prenom','prénom','first','user','login','utilisateur'] },
    { keys: ['prenom','prénom','firstname','first_name','first-name'], value: id.first_name },
    { keys: ['tel','phone','telephone','téléphone','portable'], value: id.phone || '' },
  ];

  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const st = window.getComputedStyle(el);
    return st.visibility !== "hidden" && st.display !== "none";
  };

  const setVal = (el, v) => {
    const proto = el.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  };

  const inputs = Array.from(document.querySelectorAll('input, textarea')).filter(el => {
    if (!isVisible(el)) return false;
    const t = (el.type || '').toLowerCase();
    return !['hidden','submit','button','checkbox','radio','file'].includes(t);
  });

  const filled = [];
  for (const field of fieldMap) {
    if (!field.value) continue;
    let target = null;
    for (const el of inputs) {
      const hint = ((el.name || '') + ' ' + (el.id || '') + ' ' + (el.placeholder || '') + ' ' + (el.getAttribute('aria-label') || '')).toLowerCase();
      // Look at associated label
      let labelText = '';
      if (el.id) {
        const lbl = document.querySelector('label[for="' + el.id.replace(/"/g, '\\\\"') + '"]');
        if (lbl) labelText = (lbl.innerText || '').toLowerCase();
      }
      const haystack = hint + ' ' + labelText;
      if (field.exclude && field.exclude.some(x => haystack.includes(x))) continue;
      if (field.keys.some(k => haystack.includes(k))) {
        target = el;
        break;
      }
    }
    if (target && !target.value) {
      setVal(target, field.value);
      filled.push(field.keys[0]);
    }
  }
  return { filled };
})()
`;
}

function jsDetectLoginScreen(): string {
  return `
(() => {
  const pwd = document.querySelector('input[type=password]');
  if (!pwd) return false;
  const r = pwd.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
})()
`;
}

function jsDetectRecaptcha(): string {
  return `
(() => {
  const el = document.querySelector('[data-sitekey]');
  if (el) return el.getAttribute('data-sitekey');
  const iframe = document.querySelector('iframe[src*="recaptcha"]');
  if (iframe) {
    const m = iframe.src.match(/[?&]k=([^&]+)/);
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
})()
`;
}

function jsInjectRecaptchaToken(token: string): string {
  const safe = JSON.stringify(token);
  return `
(() => {
  const t = ${safe};
  const ta = document.querySelector('textarea[name="g-recaptcha-response"]');
  if (ta) { ta.style.display='block'; ta.value = t; ta.dispatchEvent(new Event('change',{bubbles:true})); }
  try {
    const cfg = window.___grecaptcha_cfg;
    if (cfg && cfg.clients) {
      Object.values(cfg.clients).forEach(c => {
        Object.values(c).forEach(o => {
          if (o && typeof o === 'object') {
            Object.values(o).forEach(inner => {
              if (inner && typeof inner === 'object' && typeof inner.callback === 'function') {
                try { inner.callback(t); } catch (_) {}
              }
            });
          }
        });
      });
    }
  } catch (_) {}
  return true;
})()
`;
}

// ---------- 2Captcha ----------

async function solveRecaptchaV2(siteKey: string, pageUrl: string): Promise<string> {
  if (!TWOCAPTCHA_API_KEY) throw new Error("TWOCAPTCHA_API_KEY non configuré");
  const submit = await fetch(
    `https://2captcha.com/in.php?key=${TWOCAPTCHA_API_KEY}&method=userrecaptcha&googlekey=${siteKey}&pageurl=${encodeURIComponent(pageUrl)}&json=1`,
  );
  const submitData = await submit.json();
  if (submitData.status !== 1) throw new Error(`2Captcha submit: ${submitData.request}`);
  const id = submitData.request;
  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const poll = await fetch(`https://2captcha.com/res.php?key=${TWOCAPTCHA_API_KEY}&action=get&id=${id}&json=1`);
    const pollData = await poll.json();
    if (pollData.status === 1) return pollData.request as string;
    if (pollData.request !== "CAPCHA_NOT_READY") throw new Error(`2Captcha poll: ${pollData.request}`);
  }
  throw new Error("2Captcha timeout (120s)");
}

// ---------- Platform detection ----------

function detectPlatform(url: string): string {
  if (/place\.marches-publics\.gouv\.fr/i.test(url)) return "place";
  if (/achatpublic\.com/i.test(url)) return "atexo_achatpublic";
  if (/local-trust\.com/i.test(url)) return "atexo_localtrust";
  if (/marches-securises\.fr/i.test(url)) return "marches_securises";
  if (/maximilien\.fr/i.test(url)) return "maximilien";
  if (/megalis\.bretagne\.bzh/i.test(url)) return "megalis";
  return "unknown";
}

// ---------- Main handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Defensive top-level wrapper : guarantee CORS even on early throws
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const startedAt = Date.now();
  const trace: RunTrace[] = [];
  let runId: string | null = null;
  let sessionId: string | null = null;
  let cdp: CDP | null = null;
  let captchasSolved = 0;

  const log = (step: string, status: "ok" | "skipped" | "failed", detail?: string, duration_ms?: number) => {
    trace.push({ ts: new Date().toISOString(), step, status, duration_ms, detail });
    console.log(`[agent] ${status.toUpperCase()} ${step}${detail ? ` — ${detail.slice(0, 200)}` : ""}`);
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

    const { data: runRow, error: runErr } = await supabase
      .from("agent_runs")
      .insert({ tender_id, platform, dce_url, status: "running", triggered_by: triggered_by ?? null })
      .select("id")
      .single();
    if (runErr) throw new Error(`agent_runs insert: ${runErr.message}`);
    runId = runRow.id;

    const { data: playbook } = await supabase
      .from("agent_playbooks")
      .select("*")
      .eq("platform", platform)
      .eq("is_active", true)
      .maybeSingle();
    if (!playbook) throw new Error(`Aucun playbook actif pour "${platform}".`);
    log("playbook.load", "ok", playbook.display_name);

    let robot: { login: string; password_encrypted: string } | null = null;
    {
      const { data: r } = await supabase
        .from("platform_robots")
        .select("login,password_encrypted")
        .eq("platform", platform)
        .eq("is_active", true)
        .maybeSingle();
      if (r) { robot = r; log("robot.load", "ok", r.login); }
      else log("robot.load", "skipped", "aucun compte — fallback identité anonyme");
    }

    const { data: anonId } = await supabase
      .from("agent_anonymous_identity")
      .select("email,company_name,siret,last_name,first_name,phone")
      .eq("is_default", true)
      .maybeSingle();
    if (anonId) log("identity.load", "ok", anonId.email);

    // Open Browserbase session + connect CDP
    const tInit = Date.now();
    const session = await createBrowserbaseSession();
    sessionId = session.id;
    cdp = await CDP.connect(session.connectUrl);
    await cdp.attachToFirstPage();
    log("cdp.connect", "ok", `session=${sessionId}`, Date.now() - tInit);

    const steps = (playbook.steps as PlaybookStep[]) ?? [];

    for (const step of steps) {
      const stepStart = Date.now();
      const label = `${step.action}${step.instruction ? `("${step.instruction.slice(0, 60)}")` : ""}`;
      try {
        switch (step.action) {
          case "goto":
          case "navigate": {
            const target = (step.target ?? "").replace("{{dce_url}}", dce_url) || dce_url;
            await cdp.navigate(target);
            log(label, "ok", target, Date.now() - stepStart);
            break;
          }
          case "act":
          case "click":
          case "click_if_present": {
            const instruction = step.instruction ?? step.natural ?? "";
            const result = await cdp.eval(jsClickByText(instruction));
            if (result?.clicked) {
              log(label, "ok", result.text, Date.now() - stepStart);
            } else if (step.action === "click_if_present") {
              log(label, "skipped", "no match", Date.now() - stepStart);
            } else {
              throw new Error(`Aucun bouton/lien correspondant à "${instruction.slice(0, 60)}"`);
            }
            break;
          }
          case "fill_login": {
            if (!robot) { log(label, "skipped", "aucun compte robot"); break; }
            const js = `
(() => {
  const login = ${JSON.stringify(robot.login)};
  const pwd = ${JSON.stringify(robot.password_encrypted)};
  const setVal = (el, v) => {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  };
  const pwdEl = document.querySelector('input[type=password]');
  if (!pwdEl) return { ok:false };
  // login = first text/email input before password
  const all = Array.from(document.querySelectorAll('input'));
  const idx = all.indexOf(pwdEl);
  let loginEl = null;
  for (let i = idx-1; i >= 0; i--) {
    const t = (all[i].type||'').toLowerCase();
    if (['text','email',''].includes(t)) { loginEl = all[i]; break; }
  }
  if (loginEl) setVal(loginEl, login);
  setVal(pwdEl, pwd);
  return { ok:true };
})()`;
            const r = await cdp.eval(js);
            log(label, r?.ok ? "ok" : "skipped", r?.ok ? robot.login : "no password field", Date.now() - stepStart);
            break;
          }
          case "fill_anonymous_identity": {
            if (!anonId) { log(label, "skipped", "aucune identité anonyme"); break; }
            const isLogin = await cdp.eval(jsDetectLoginScreen());
            if (isLogin) { log(label, "skipped", "écran de login détecté"); break; }
            const r = await cdp.eval(jsFillIdentity(anonId as any));
            log(label, "ok", `champs: ${(r?.filled ?? []).join(",")}`, Date.now() - stepStart);
            break;
          }
          case "solve_captcha":
          case "solve_captcha_if_present": {
            const siteKey = await cdp.eval(jsDetectRecaptcha());
            if (!siteKey) {
              if (step.action === "solve_captcha_if_present") {
                log(label, "skipped", "aucun captcha détecté", Date.now() - stepStart);
                break;
              }
              throw new Error("Aucun reCAPTCHA détecté");
            }
            const pageUrl = await cdp.url();
            const token = await solveRecaptchaV2(siteKey, pageUrl);
            await cdp.eval(jsInjectRecaptchaToken(token));
            captchasSolved++;
            log(label, "ok", `sitekey=${String(siteKey).slice(0, 12)}…`, Date.now() - stepStart);
            break;
          }
          case "wait": {
            await new Promise((r) => setTimeout(r, step.timeout_ms ?? 3000));
            log(label, "ok", undefined, Date.now() - stepStart);
            break;
          }
          case "download":
          case "wait_download": {
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
        log("storage.upload", "skipped", "aucune archive");
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
      await supabase.from("platform_robots")
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
    if (cdp) cdp.close();
    if (sessionId) await closeBrowserbaseSession(sessionId);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[agent] FATAL", err);
    if (cdp) cdp.close();
    if (sessionId) await closeBrowserbaseSession(sessionId);
    if (runId) {
      const isTimeout = /timeout/i.test(err.message ?? "");
      await supabase
        .from("agent_runs")
        .update({
          status: isTimeout ? "timeout" : "failed",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startedAt,
          error_message: err.message ?? String(err),
          trace: trace as any,
          captchas_solved: captchasSolved,
          browserbase_session_id: sessionId,
        })
        .eq("id", runId);
    }
    return new Response(
      JSON.stringify({ success: false, error: err.message ?? String(err), run_id: runId, trace }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
