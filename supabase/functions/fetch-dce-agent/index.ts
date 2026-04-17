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
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
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

const CLICKABLE_SELECTOR = `a, button, input[type=submit], input[type=button], [role=button], [onclick], [mat-button], [mat-raised-button], [mat-flat-button], [mat-stroked-button], .mat-button, .mat-raised-button, .ui-button, .p-button, .btn`;
const INPUT_SELECTOR = `input, textarea, [role=textbox], [contenteditable="true"], p-inputtext input, mat-form-field input, mat-form-field textarea`;

function jsClickByText(instruction: string): string {
  const safe = JSON.stringify(instruction);
  const sel = JSON.stringify(CLICKABLE_SELECTOR);
  return `
(() => {
  const instruction = ${safe}.toLowerCase();
  const raw = instruction
    .replace(/[()\\[\\]]/g, ",")
    .split(/[,;:]/)
    .map(s => s.trim())
    .filter(s => s.length >= 3 && s.length < 80);
  const phrases = raw.length ? raw : [instruction];
  const submitWords = ['valider','valide','confirmer','envoyer','soumettre','télécharger','telecharger','retrait','retirer','accepter','continuer','suivant'];

  const isVisible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const st = window.getComputedStyle(el);
    return st.visibility !== "hidden" && st.display !== "none" && st.opacity !== "0";
  };

  // Collect candidates from main doc + same-origin iframes
  const docs = [document];
  try {
    for (const fr of Array.from(document.querySelectorAll('iframe'))) {
      try { if (fr.contentDocument) docs.push(fr.contentDocument); } catch (_) {}
    }
  } catch (_) {}

  const candidates = [];
  for (const d of docs) {
    try {
      for (const el of Array.from(d.querySelectorAll(${sel}))) candidates.push(el);
    } catch (_) {}
  }

  // Priority pass : if instruction contains a submit-word, prefer matching <input type="submit">
  const wantsSubmit = submitWords.some(w => instruction.includes(w));
  if (wantsSubmit) {
    for (const el of candidates) {
      if (!isVisible(el)) continue;
      const tag = el.tagName.toLowerCase();
      const type = (el.type || '').toLowerCase();
      if (tag === 'input' && (type === 'submit' || type === 'button')) {
        const value = (el.value || '').toLowerCase().trim();
        if (!value) continue;
        for (const w of submitWords) {
          if (instruction.includes(w) && value.includes(w)) {
            el.scrollIntoView({ block: 'center' });
            el.click();
            return { clicked: true, text: el.value.slice(0, 80), via: 'submit-priority:' + w };
          }
        }
      }
    }
  }

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
    if (!best && el.type === 'submit') {
      for (const w of submitWords) {
        if (instruction.includes(w) && text.includes(w)) {
          best = el; bestScore = w.length;
        }
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

// ---------- LLM-assisted snapshot helpers ----------

function jsSnapshotClickables(): string {
  const sel = JSON.stringify(CLICKABLE_SELECTOR);
  return `
(() => {
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const st = window.getComputedStyle(el);
    return st.visibility !== "hidden" && st.display !== "none" && st.opacity !== "0";
  };
  const els = Array.from(document.querySelectorAll(${sel}));
  const out = [];
  let idx = 0;
  for (const el of els) {
    if (!isVisible(el)) continue;
    const text = (el.innerText || el.value || '').trim().slice(0, 120).replace(/\\s+/g, ' ');
    const aria = el.getAttribute('aria-label') || '';
    const title = el.title || '';
    const id = el.id || '';
    out.push({ i: idx, tag: el.tagName.toLowerCase(), text, aria, title, id });
    el.setAttribute('data-agent-idx', String(idx));
    idx++;
    if (idx >= 200) break;
  }
  return out;
})()
`;
}

function jsClickByIndex(idx: number): string {
  return `
(() => {
  const el = document.querySelector('[data-agent-idx="' + ${idx} + '"]');
  if (!el) return { clicked: false, reason: "index not found" };
  el.scrollIntoView({ block: "center" });
  el.click();
  return { clicked: true, text: (el.innerText || el.value || '').slice(0, 80) };
})()
`;
}

function jsCountVisibleInputs(): string {
  const sel = JSON.stringify(INPUT_SELECTOR);
  return `
(() => {
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const st = window.getComputedStyle(el);
    return st.visibility !== "hidden" && st.display !== "none";
  };
  const docs = [document];
  try {
    for (const fr of Array.from(document.querySelectorAll('iframe'))) {
      try { if (fr.contentDocument) docs.push(fr.contentDocument); } catch (_) {}
    }
  } catch (_) {}
  let count = 0;
  for (const d of docs) {
    try {
      const els = Array.from(d.querySelectorAll(${sel})).filter(el => {
        if (!isVisible(el)) return false;
        const t = (el.type || '').toLowerCase();
        return !['hidden','submit','button','checkbox','radio','file'].includes(t);
      });
      count += els.length;
    } catch (_) {}
  }
  return count;
})()
`;
}

function jsSnapshotInputs(): string {
  const sel = JSON.stringify(INPUT_SELECTOR);
  return `
(() => {
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const st = window.getComputedStyle(el);
    return st.visibility !== "hidden" && st.display !== "none";
  };
  const docs = [document];
  try {
    for (const fr of Array.from(document.querySelectorAll('iframe'))) {
      try { if (fr.contentDocument) docs.push(fr.contentDocument); } catch (_) {}
    }
  } catch (_) {}
  const els = [];
  for (const d of docs) {
    try {
      for (const el of Array.from(d.querySelectorAll(${sel}))) {
        if (!isVisible(el)) continue;
        const t = (el.type || '').toLowerCase();
        if (['hidden','submit','button','checkbox','radio','file'].includes(t)) continue;
        els.push(el);
      }
    } catch (_) {}
  }
  const out = [];
  let idx = 0;
  for (const el of els) {
    let labelText = '';
    if (el.id) {
      const lbl = document.querySelector('label[for="' + el.id.replace(/"/g,'\\\\"') + '"]');
      if (lbl) labelText = (lbl.innerText || '').trim().slice(0, 80);
    }
    if (!labelText) {
      let p = el.parentElement;
      for (let k = 0; k < 4 && p; k++) {
        if (p.tagName === 'LABEL' || /mat-form-field|p-field/i.test(p.className || '')) {
          labelText = (p.innerText || '').trim().slice(0, 80);
          if (labelText) break;
        }
        p = p.parentElement;
      }
    }
    out.push({
      i: idx,
      tag: el.tagName.toLowerCase(),
      type: (el.type || '').toLowerCase(),
      name: el.name || '',
      id: el.id || '',
      placeholder: el.placeholder || '',
      aria: el.getAttribute('aria-label') || '',
      label: labelText,
    });
    el.setAttribute('data-agent-input-idx', String(idx));
    idx++;
    if (idx >= 80) break;
  }
  return out;
})()
`;
}

function jsFillByIndex(mapping: Record<string, string>): string {
  const safe = JSON.stringify(mapping);
  return `
(() => {
  const m = ${safe};
  const setVal = (el, v) => {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  };
  const filled = [];
  for (const [idx, v] of Object.entries(m)) {
    const el = document.querySelector('[data-agent-input-idx="' + idx + '"]');
    if (el && v) { setVal(el, v); filled.push(idx); }
  }
  return { filled };
})()
`;
}

// ---------- LLM calls (Lovable AI Gateway) ----------

async function llmPickClickable(
  instruction: string,
  candidates: Array<{ i: number; tag: string; text: string; aria: string; title: string; id: string }>,
): Promise<number> {
  if (!LOVABLE_API_KEY) return -1;
  const compact = candidates
    .filter((c) => (c.text || c.aria || c.title))
    .map((c) => `${c.i}: <${c.tag}> "${(c.text || c.aria || c.title).slice(0, 80)}"${c.id ? ` #${c.id}` : ""}`)
    .join("\n");
  const sys = `Tu es un agent d'automatisation web. On te donne une liste numérotée d'éléments cliquables visibles sur une page.
Retourne UNIQUEMENT un entier : l'index de l'élément qui correspond le mieux à l'instruction utilisateur.
Si aucun élément ne correspond, retourne -1. N'écris RIEN d'autre que le nombre.`;
  const user = `Instruction: ${instruction}\n\nÉléments:\n${compact}`;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      }),
    });
    if (!res.ok) return -1;
    const data = await res.json();
    const txt = (data.choices?.[0]?.message?.content ?? "").trim();
    const m = txt.match(/-?\d+/);
    if (!m) return -1;
    const n = parseInt(m[0], 10);
    return Number.isFinite(n) ? n : -1;
  } catch {
    return -1;
  }
}

async function llmMapInputs(
  identity: Record<string, string>,
  inputs: Array<any>,
): Promise<Record<string, string>> {
  if (!LOVABLE_API_KEY) return {};
  const compact = inputs
    .map((c) => `${c.i}: <${c.tag} type=${c.type}> name="${c.name}" id="${c.id}" placeholder="${c.placeholder}" aria="${c.aria}" label="${c.label}"`)
    .join("\n");
  const fields = Object.entries(identity)
    .filter(([_, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  const sys = `Tu es un agent d'automatisation web. On te donne une liste d'inputs visibles d'un formulaire et des champs d'identité à remplir.
Retourne UNIQUEMENT un objet JSON {"<index>": "<valeur>"} associant chaque input à la valeur d'identité la plus pertinente.
Ignore les inputs qui ne correspondent à aucune valeur. Aucune explication.`;
  const user = `Identité:\n${fields}\n\nInputs:\n${compact}`;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return {};
    const data = await res.json();
    const txt = (data.choices?.[0]?.message?.content ?? "{}").trim();
    const parsed = JSON.parse(txt);
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string" && v) out[String(k)] = v;
    }
    return out;
  } catch {
    return {};
  }
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

// ---------- Image CAPTCHA helpers (DOM detection + base64 capture) ----------

function jsDetectImageCaptcha(): string {
  return `
(() => {
  // Heuristics: <img> with src/alt/id/class containing "captcha", visible
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return false;
    const st = window.getComputedStyle(el);
    return st.visibility !== "hidden" && st.display !== "none" && st.opacity !== "0";
  };
  const imgs = Array.from(document.querySelectorAll('img'));
  const captchaImg = imgs.find(img => {
    if (!isVisible(img)) return false;
    const hay = ((img.src||'') + ' ' + (img.alt||'') + ' ' + (img.id||'') + ' ' + (img.className||'')).toLowerCase();
    return hay.includes('captcha') || hay.includes('securimage') || hay.includes('antispam');
  });
  if (!captchaImg) return null;
  // Find probable input: nearest visible text input after the image
  const inputs = Array.from(document.querySelectorAll('input[type=text], input:not([type])')).filter(isVisible);
  let inputId = '';
  let inputName = '';
  let inputIdx = -1;
  // Prefer inputs whose name/id/placeholder/label hints captcha
  for (const inp of inputs) {
    const hay = ((inp.name||'') + ' ' + (inp.id||'') + ' ' + (inp.placeholder||'') + ' ' + (inp.getAttribute('aria-label')||'')).toLowerCase();
    if (hay.includes('captcha') || hay.includes('code') || hay.includes('image') || hay.includes('verif')) {
      inputId = inp.id || '';
      inputName = inp.name || '';
      inp.setAttribute('data-agent-captcha-input', '1');
      inputIdx = 1;
      break;
    }
  }
  // Fallback: input that comes after the captcha img in DOM order
  if (inputIdx < 0) {
    const all = Array.from(document.querySelectorAll('*'));
    const imgPos = all.indexOf(captchaImg);
    for (const inp of inputs) {
      if (all.indexOf(inp) > imgPos) {
        inputId = inp.id || '';
        inputName = inp.name || '';
        inp.setAttribute('data-agent-captcha-input', '1');
        inputIdx = 1;
        break;
      }
    }
  }
  captchaImg.setAttribute('data-agent-captcha-img', '1');
  return {
    src: captchaImg.src,
    width: captchaImg.naturalWidth || captchaImg.width,
    height: captchaImg.naturalHeight || captchaImg.height,
    inputId,
    inputName,
    hasInput: inputIdx >= 0,
  };
})()
`;
}

function jsCaptureCaptchaBase64(): string {
  return `
(async () => {
  const img = document.querySelector('img[data-agent-captcha-img="1"]');
  if (!img) return null;
  // Wait if image not yet loaded
  if (!img.complete) {
    await new Promise(res => { img.onload = res; img.onerror = res; setTimeout(res, 3000); });
  }
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl.split(',')[1] || null;
  } catch (e) {
    // CORS-tainted: try fetch then FileReader
    try {
      const r = await fetch(img.src, { credentials: 'include' });
      const blob = await r.blob();
      return await new Promise((resolve) => {
        const fr = new FileReader();
        fr.onloadend = () => {
          const s = String(fr.result || '');
          resolve(s.split(',')[1] || null);
        };
        fr.onerror = () => resolve(null);
        fr.readAsDataURL(blob);
      });
    } catch (_) {
      return null;
    }
  }
})()
`;
}

function jsFillCaptchaInput(text: string): string {
  const safe = JSON.stringify(text);
  return `
(() => {
  const v = ${safe};
  const setVal = (el, val) => {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  };
  const tagged = document.querySelector('input[data-agent-captcha-input="1"]');
  if (tagged) { setVal(tagged, v); return { ok: true, via: 'tagged' }; }
  // Fallback: any input with name/id containing captcha
  const inputs = Array.from(document.querySelectorAll('input'));
  const target = inputs.find(inp => {
    const hay = ((inp.name||'') + ' ' + (inp.id||'') + ' ' + (inp.placeholder||'')).toLowerCase();
    return hay.includes('captcha') || hay.includes('code');
  });
  if (target) { setVal(target, v); return { ok: true, via: 'heuristic' }; }
  return { ok: false };
})()
`;
}

// ---------- 2Captcha ----------

async function solveImageCaptcha(base64: string): Promise<string> {
  if (!TWOCAPTCHA_API_KEY) throw new Error("TWOCAPTCHA_API_KEY non configuré");
  // Submit base64 image
  const form = new FormData();
  form.append("key", TWOCAPTCHA_API_KEY);
  form.append("method", "base64");
  form.append("body", base64);
  form.append("json", "1");
  // Common hints for AWS-Achat / SecurImage style captchas: 6 chars, alphanumeric
  form.append("regsense", "1"); // case-sensitive matters less, set 0 if needed
  form.append("min_len", "4");
  form.append("max_len", "8");
  const submit = await fetch("https://2captcha.com/in.php", { method: "POST", body: form });
  const submitData = await submit.json();
  if (submitData.status !== 1) throw new Error(`2Captcha submit (image): ${submitData.request}`);
  const id = submitData.request;
  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const poll = await fetch(`https://2captcha.com/res.php?key=${TWOCAPTCHA_API_KEY}&action=get&id=${id}&json=1`);
    const pollData = await poll.json();
    if (pollData.status === 1) return String(pollData.request);
    if (pollData.request !== "CAPCHA_NOT_READY") throw new Error(`2Captcha poll (image): ${pollData.request}`);
  }
  throw new Error("2Captcha image timeout (120s)");
}

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

// Hard-coded hostname → platform mapping (fallback heuristic when DB regex doesn't match)
const HOSTNAME_PLATFORM_MAP: Array<[RegExp, string]> = [
  [/place\.marches-publics\.gouv\.fr/i, "place"],
  [/marches-publics\.info/i, "mpi"],
  [/achatpublic\.com/i, "atexo_achatpublic"],
  [/local-trust\.com/i, "atexo_localtrust"],
  [/marches-securises\.fr/i, "marches_securises"],
  [/maximilien\.fr/i, "maximilien"],
  [/megalis\.bretagne\.bzh/i, "megalis"],
  [/megalisbretagne\.org/i, "megalis"],
  [/e-marchespublics\.com/i, "emarchespublics"],
  [/atexo/i, "atexo_achatpublic"],
];

function detectPlatformHeuristic(url: string): string {
  for (const [re, platform] of HOSTNAME_PLATFORM_MAP) {
    if (re.test(url)) return platform;
  }
  return "unknown";
}

/**
 * Three-level cascade:
 * 1. Match against active playbooks' url_pattern (regex) loaded from DB
 * 2. Hostname heuristic mapping
 * 3. "generic" fallback (LLM-first playbook that should always exist in DB)
 */
async function detectPlatform(
  supabase: ReturnType<typeof createClient>,
  url: string,
): Promise<string> {
  // 1. DB-driven regex match
  try {
    const { data: playbooks } = await supabase
      .from("agent_playbooks")
      .select("platform, url_pattern")
      .eq("is_active", true);
    if (playbooks) {
      for (const pb of playbooks as Array<{ platform: string; url_pattern: string }>) {
        if (pb.platform === "generic" || !pb.url_pattern || pb.url_pattern === ".*") continue;
        try {
          if (new RegExp(pb.url_pattern, "i").test(url)) return pb.platform;
        } catch (_) { /* invalid regex, skip */ }
      }
    }
  } catch (_) { /* DB unreachable, fall through */ }

  // 2. Hardcoded hostname heuristic
  const heuristic = detectPlatformHeuristic(url);
  if (heuristic !== "unknown") return heuristic;

  // 3. Generic LLM-first fallback
  return "generic";
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

    const platform = await detectPlatform(supabase, dce_url);
    log("router.detect_platform", "ok", platform);

    const { data: runRow, error: runErr } = await supabase
      .from("agent_runs")
      .insert({ tender_id, platform, dce_url, status: "running", triggered_by: triggered_by ?? null })
      .select("id")
      .single();
    if (runErr) throw new Error(`agent_runs insert: ${runErr.message}`);
    runId = runRow.id;

    let { data: playbook } = await supabase
      .from("agent_playbooks")
      .select("*")
      .eq("platform", platform)
      .eq("is_active", true)
      .maybeSingle();

    // Last-chance fallback to generic playbook if nothing matched
    if (!playbook && platform !== "generic") {
      const { data: gen } = await supabase
        .from("agent_playbooks")
        .select("*")
        .eq("platform", "generic")
        .eq("is_active", true)
        .maybeSingle();
      if (gen) {
        playbook = gen;
        log("playbook.fallback_generic", "ok", `no playbook for "${platform}", using generic`);
      }
    }

    if (!playbook) {
      throw new Error(
        `Aucun playbook actif pour "${platform}" et aucun playbook "generic" disponible. URL: ${dce_url}`,
      );
    }
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
            const urlBefore = await cdp.url().catch(() => "");
            const isStrictAct = step.action === "act";

            // Strict 'act' uses LLM-first (more reliable for ambiguous final-submit buttons).
            // 'click_if_present' / 'click' uses heuristic-first (faster, common case).
            let chosen: { mode: string; idx?: number; text?: string } | null = null;

            if (isStrictAct) {
              const snapshot = await cdp.eval(jsSnapshotClickables());
              const idx = await llmPickClickable(instruction, snapshot ?? []);
              if (idx >= 0) {
                const r = await cdp.eval(jsClickByIndex(idx));
                if (r?.clicked) chosen = { mode: "llm", idx, text: r.text };
              }
              if (!chosen) {
                const heur = await cdp.eval(jsClickByText(instruction));
                if (heur?.clicked) chosen = { mode: "heuristic-fallback", text: heur.text };
              }
              if (!chosen) {
                const top5 = Array.isArray(snapshot)
                  ? snapshot.slice(0, 5).map((c: any) => `[${c.i}] ${c.tag}${c.text ? ` "${String(c.text).slice(0, 40)}"` : ""}`).join(" | ")
                  : "(empty)";
                throw new Error(`Aucun bouton/lien correspondant à "${instruction.slice(0, 60)}" — top5: ${top5}`);
              }
            } else {
              const result = await cdp.eval(jsClickByText(instruction));
              if (result?.clicked) {
                chosen = { mode: "heuristic", text: result.text };
              } else {
                const snapshot = await cdp.eval(jsSnapshotClickables());
                const idx = await llmPickClickable(instruction, snapshot ?? []);
                if (idx >= 0) {
                  const r2 = await cdp.eval(jsClickByIndex(idx));
                  if (r2?.clicked) chosen = { mode: "llm", idx, text: r2.text };
                }
                if (!chosen) {
                  const top5 = Array.isArray(snapshot)
                    ? snapshot.slice(0, 5).map((c: any) => `[${c.i}] ${c.tag}${c.text ? ` "${String(c.text).slice(0, 40)}"` : ""}${c.aria ? ` aria="${String(c.aria).slice(0, 30)}"` : ""}`).join(" | ")
                    : "(empty snapshot)";
                  log(label, "skipped", `no match (heuristic+llm) — top5: ${top5} — url=${urlBefore.slice(0, 80)}`, Date.now() - stepStart);
                  break;
                }
              }
            }

            log(label, "ok", `(${chosen.mode}${chosen.idx !== undefined ? ` idx=${chosen.idx}` : ""}) ${chosen.text ?? ""} — url=${urlBefore.slice(0, 80)}`, Date.now() - stepStart);
            break;
          }
          case "wait_for_inputs": {
            const minInputs = (step as any).min ?? 1;
            const timeoutMs = step.timeout_ms ?? 8000;
            const startWait = Date.now();
            let count = 0;
            while (Date.now() - startWait < timeoutMs) {
              count = await cdp.eval(jsCountVisibleInputs());
              if (count >= minInputs) break;
              await new Promise((r) => setTimeout(r, 500));
            }
            if (count >= minInputs) {
              log(label, "ok", `${count} inputs visibles (min=${minInputs})`, Date.now() - stepStart);
            } else {
              log(label, "skipped", `seulement ${count} inputs après ${timeoutMs}ms (min=${minInputs})`, Date.now() - stepStart);
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
            const urlBefore = await cdp.url().catch(() => "");
            const visibleCount = await cdp.eval(jsCountVisibleInputs());
            // For complex platforms (5+ inputs) the heuristic often misses fields → go LLM-first.
            const tryHeuristicFirst = (visibleCount as number) <= 4;
            let filledVia = "";
            let filledFields: string[] = [];

            if (tryHeuristicFirst) {
              const r = await cdp.eval(jsFillIdentity(anonId as any));
              filledFields = (r?.filled ?? []) as string[];
              if (filledFields.length > 0) {
                filledVia = "heuristic";
              }
            }

            if (filledFields.length === 0) {
              const inputs = await cdp.eval(jsSnapshotInputs());
              if (!inputs || inputs.length === 0) {
                log(label, "skipped", `aucun input visible — url=${urlBefore.slice(0, 80)}`, Date.now() - stepStart);
                break;
              }
              const mapping = await llmMapInputs(anonId as any, inputs);
              if (Object.keys(mapping).length === 0) {
                // Last-resort heuristic if we hadn't tried it yet
                if (!tryHeuristicFirst) {
                  const r = await cdp.eval(jsFillIdentity(anonId as any));
                  filledFields = (r?.filled ?? []) as string[];
                  if (filledFields.length > 0) {
                    log(label, "ok", `(heuristic-fallback) champs: ${filledFields.join(",")} — url=${urlBefore.slice(0, 80)}`, Date.now() - stepStart);
                    break;
                  }
                }
                log(label, "skipped", `LLM n'a mappé aucun champ (${inputs.length} inputs vus) — url=${urlBefore.slice(0, 80)}`, Date.now() - stepStart);
                break;
              }
              const fillRes = await cdp.eval(jsFillByIndex(mapping));
              filledFields = (fillRes?.filled ?? []) as string[];
              filledVia = "llm";
            }
            log(label, "ok", `(${filledVia}) champs: ${filledFields.join(",")} — url=${urlBefore.slice(0, 80)}`, Date.now() - stepStart);
            break;
          }
          case "solve_image_captcha":
          case "solve_image_captcha_if_present": {
            const optional = step.action === "solve_image_captcha_if_present";
            const detected = await cdp.eval(jsDetectImageCaptcha());
            if (!detected) {
              if (optional) { log(label, "skipped", "aucun captcha image détecté", Date.now() - stepStart); break; }
              throw new Error("Aucun captcha image détecté");
            }
            const b64 = await cdp.eval(jsCaptureCaptchaBase64());
            if (!b64 || typeof b64 !== "string" || b64.length < 50) {
              if (optional) { log(label, "skipped", "capture base64 vide", Date.now() - stepStart); break; }
              throw new Error("Impossible de capturer l'image du captcha (base64 vide)");
            }
            const tSolve = Date.now();
            const solution = await solveImageCaptcha(b64);
            const fillRes = await cdp.eval(jsFillCaptchaInput(solution));
            if (!fillRes?.ok) {
              throw new Error(`Captcha résolu (${solution}) mais champ d'input introuvable`);
            }
            captchasSolved++;
            log(label, "ok", `texte="${solution}" via=${fillRes.via} solve=${Date.now() - tSolve}ms`, Date.now() - stepStart);
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
            agent_run_id: runId,
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
