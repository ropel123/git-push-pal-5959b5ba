// MPI (marches-publics.info) client — Deno-native, no Browserbase.
// Auth flow: captcha 1st time → POST login → reusable session cookies (~12h).
//
// IMPORTANT: This is a best-effort implementation based on visible flow.
// MPI runs on ColdFusion (fuseaction=...). Field names may need tweaking
// after observing actual responses in logs.

const TWOCAPTCHA_API_KEY = Deno.env.get("TWOCAPTCHA_API_KEY") ?? "";
const MPI_LOGIN = Deno.env.get("MPI_LOGIN") ?? "";
const MPI_PASSWORD = Deno.env.get("MPI_PASSWORD") ?? "";

const BASE = "https://www.marches-publics.info";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export type CookieJar = Record<string, string>;

export function jarToHeader(jar: CookieJar): string {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
}

export function mergeSetCookies(jar: CookieJar, headers: Headers): CookieJar {
  // Deno exposes raw multi-value Set-Cookie via headers.getSetCookie() (Std fetch)
  const raw = (headers as any).getSetCookie?.() as string[] | undefined;
  const list = raw && raw.length ? raw : headers.get("set-cookie")?.split(/,(?=\s*\w+=)/) ?? [];
  for (const sc of list) {
    const first = sc.split(";")[0]?.trim();
    if (!first) continue;
    const eq = first.indexOf("=");
    if (eq <= 0) continue;
    const name = first.slice(0, eq).trim();
    const value = first.slice(eq + 1).trim();
    if (name) jar[name] = value;
  }
  return jar;
}

async function mpiFetch(
  jar: CookieJar,
  url: string,
  init: RequestInit = {},
): Promise<{ res: Response; text: string; bytes: Uint8Array }> {
  const headers = new Headers(init.headers);
  headers.set("User-Agent", UA);
  headers.set("Accept-Language", "fr-FR,fr;q=0.9,en;q=0.8");
  if (!headers.has("Accept")) {
    headers.set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
  }
  const cookieHeader = jarToHeader(jar);
  if (cookieHeader) headers.set("Cookie", cookieHeader);

  const res = await fetch(url, { ...init, headers, redirect: "manual" });
  mergeSetCookies(jar, res.headers);

  // Manual redirect handling (so we capture cookies on each hop)
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location");
    if (loc) {
      const next = new URL(loc, url).toString();
      console.log(`[mpi] redirect ${res.status} -> ${next.slice(0, 120)}`);
      return mpiFetch(jar, next, { method: "GET" });
    }
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  const ct = res.headers.get("content-type") ?? "";
  const isText = /text|html|xml|json|urlencoded/i.test(ct);
  const text = isText ? new TextDecoder("utf-8", { fatal: false }).decode(bytes) : "";
  return { res, text, bytes };
}

// ---------- HTML parsing helpers ----------

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i"))
    ?? tag.match(new RegExp(`${name}\\s*=\\s*'([^']*)'`, "i"));
  return m ? m[1] : null;
}

interface FormSpec {
  action: string;
  method: string;
  fields: Record<string, string>;
  rawHtml: string;
}

function parseForms(html: string, baseUrl: string): FormSpec[] {
  const forms: FormSpec[] = [];
  const re = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const openTag = `<form ${m[1]}>`;
    const inner = m[2];
    const action = attr(openTag, "action") ?? baseUrl;
    const method = (attr(openTag, "method") ?? "GET").toUpperCase();
    const fields: Record<string, string> = {};
    const inputRe = /<(input|textarea|select)\b([^>]*)>/gi;
    let im: RegExpExecArray | null;
    while ((im = inputRe.exec(inner)) !== null) {
      const tag = im[0];
      const name = attr(tag, "name");
      if (!name) continue;
      const type = (attr(tag, "type") ?? "").toLowerCase();
      if (type === "submit" || type === "button" || type === "image") continue;
      const value = attr(tag, "value") ?? "";
      fields[name] = value;
    }
    forms.push({ action: new URL(action, baseUrl).toString(), method, fields, rawHtml: m[0] });
  }
  return forms;
}

function looksLikeLoginForm(form: FormSpec): boolean {
  const lower = form.rawHtml.toLowerCase();
  return /type\s*=\s*["']?password/i.test(form.rawHtml) ||
    lower.includes("motdepasse") || lower.includes("password");
}

function looksLikeDcePage(html: string): boolean {
  // Heuristic: checkboxes for lots + a "télécharger" submit
  const lower = html.toLowerCase();
  return /télécharger|telecharger/.test(lower) &&
    (/lot\s*\d/i.test(html) || /idlot/i.test(html));
}

// ---------- 2Captcha ----------

async function solveImageCaptcha(imageBase64: string): Promise<string> {
  if (!TWOCAPTCHA_API_KEY) throw new Error("TWOCAPTCHA_API_KEY missing");
  const inForm = new FormData();
  inForm.append("key", TWOCAPTCHA_API_KEY);
  inForm.append("method", "base64");
  inForm.append("body", imageBase64);
  inForm.append("json", "1");
  const inRes = await fetch("https://2captcha.com/in.php", { method: "POST", body: inForm });
  const inData = await inRes.json();
  if (inData.status !== 1) throw new Error(`2captcha in: ${inData.request}`);
  const id = inData.request;
  console.log(`[mpi] 2captcha task=${id} polling…`);

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 5_000));
    const r = await fetch(
      `https://2captcha.com/res.php?key=${TWOCAPTCHA_API_KEY}&action=get&id=${id}&json=1`,
    );
    const d = await r.json();
    if (d.status === 1) {
      console.log(`[mpi] 2captcha solved: ${String(d.request).slice(0, 8)}…`);
      return String(d.request);
    }
    if (d.request !== "CAPCHA_NOT_READY") throw new Error(`2captcha res: ${d.request}`);
  }
  throw new Error("2captcha timeout");
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  // deno-lint-ignore no-deprecated-deno-api
  return btoa(bin);
}

function findCaptchaImageUrl(html: string, baseUrl: string): string | null {
  // Look for <img ... src="...captcha..." ...>
  const re = /<img\b[^>]*src\s*=\s*["']([^"']*)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (/captcha|captch|verif/i.test(m[0])) {
      return new URL(m[1], baseUrl).toString();
    }
  }
  return null;
}

// ---------- Login ----------

export async function loginMpi(jar: CookieJar, dceUrl: string): Promise<{
  captchaSolved: boolean;
  finalHtml: string;
  finalUrl: string;
}> {
  if (!MPI_LOGIN || !MPI_PASSWORD) throw new Error("MPI_LOGIN/MPI_PASSWORD missing");

  // 1. GET landing page (captcha + login form)
  console.log(`[mpi] GET landing ${dceUrl}`);
  const landing = await mpiFetch(jar, dceUrl);
  if (!landing.text) throw new Error(`landing not html (status=${landing.res.status})`);

  // 2. Locate login form
  const forms = parseForms(landing.text, dceUrl);
  console.log(`[mpi] landing forms=${forms.length}`);
  const loginForm = forms.find(looksLikeLoginForm);
  if (!loginForm) {
    // Maybe already logged-in or different layout — caller will detect
    return { captchaSolved: false, finalHtml: landing.text, finalUrl: landing.res.url || dceUrl };
  }

  // 3. Solve captcha if present
  let captchaSolved = false;
  const captchaUrl = findCaptchaImageUrl(landing.text, dceUrl);
  let captchaValue = "";
  if (captchaUrl) {
    console.log(`[mpi] captcha img ${captchaUrl}`);
    const img = await mpiFetch(jar, captchaUrl);
    const b64 = bytesToBase64(img.bytes);
    captchaValue = await solveImageCaptcha(b64);
    captchaSolved = true;
  } else {
    console.log("[mpi] no captcha image found");
  }

  // 4. Fill login form fields (best-effort name matching)
  const data = { ...loginForm.fields };
  for (const k of Object.keys(data)) {
    const lk = k.toLowerCase();
    if (lk.includes("mail") || lk === "login" || lk === "user" || lk.includes("ident")) {
      data[k] = MPI_LOGIN;
    } else if (lk.includes("pass") || lk.includes("motdepasse") || lk === "mdp") {
      data[k] = MPI_PASSWORD;
    } else if (captchaValue && (lk.includes("captcha") || lk.includes("code") || lk.includes("verif"))) {
      data[k] = captchaValue;
    }
  }
  // If no obvious email field matched, add common defaults
  if (!Object.values(data).includes(MPI_LOGIN)) data["email"] = MPI_LOGIN;
  if (!Object.values(data).includes(MPI_PASSWORD)) data["password"] = MPI_PASSWORD;
  if (captchaValue && !Object.values(data).includes(captchaValue)) data["captcha"] = captchaValue;

  const body = new URLSearchParams(data).toString();
  console.log(`[mpi] POST login ${loginForm.action} fields=${Object.keys(data).join(",")}`);
  const posted = await mpiFetch(jar, loginForm.action, {
    method: loginForm.method === "POST" ? "POST" : "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Referer": dceUrl,
      "Origin": BASE,
    },
    body,
  });

  return { captchaSolved, finalHtml: posted.text, finalUrl: posted.res.url || loginForm.action };
}

// ---------- DCE download ----------

export async function downloadDce(jar: CookieJar, dceUrl: string, currentHtml?: string): Promise<{
  bytes: Uint8Array;
  contentType: string;
  lotCount: number;
}> {
  // 1. Ensure we're on DCE page
  let html = currentHtml ?? "";
  if (!html || !looksLikeDcePage(html)) {
    console.log(`[mpi] GET dce ${dceUrl}`);
    const r = await mpiFetch(jar, dceUrl);
    html = r.text;
  }
  if (!looksLikeDcePage(html)) {
    throw new Error("Not on DCE page after auth (lots/télécharger not found)");
  }

  // 2. Find download form (contains lot checkboxes)
  const forms = parseForms(html, dceUrl);
  console.log(`[mpi] dce forms=${forms.length}`);

  // Heuristic: form with most "lot" checkboxes
  let bestForm: FormSpec | null = null;
  let bestLots = 0;
  for (const f of forms) {
    const lots = (f.rawHtml.match(/type\s*=\s*["']?checkbox/gi) ?? []).length;
    if (lots > bestLots) { bestLots = lots; bestForm = f; }
  }
  if (!bestForm) throw new Error("No download form found on DCE page");
  console.log(`[mpi] dce form action=${bestForm.action} checkboxes=${bestLots}`);

  // 3. Check ALL checkboxes (extract their names + values, even if currently unchecked)
  const data: Record<string, string | string[]> = { ...bestForm.fields };
  const cbRe = /<input\b[^>]*type\s*=\s*["']?checkbox[^>]*>/gi;
  let cm: RegExpExecArray | null;
  const cbMulti: Record<string, string[]> = {};
  while ((cm = cbRe.exec(bestForm.rawHtml)) !== null) {
    const name = attr(cm[0], "name");
    const value = attr(cm[0], "value") ?? "on";
    if (!name) continue;
    (cbMulti[name] ??= []).push(value);
  }
  for (const [name, vals] of Object.entries(cbMulti)) {
    if (vals.length === 1) data[name] = vals[0];
    else data[name] = vals;
  }

  // 4. POST download
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(data)) {
    if (Array.isArray(v)) v.forEach((vv) => body.append(k, vv));
    else body.append(k, v);
  }

  console.log(`[mpi] POST download ${bestForm.action}`);
  const headers = new Headers({
    "User-Agent": UA,
    "Content-Type": "application/x-www-form-urlencoded",
    "Cookie": jarToHeader(jar),
    "Referer": dceUrl,
    "Origin": BASE,
    "Accept": "*/*",
  });
  const res = await fetch(bestForm.action, { method: "POST", headers, body: body.toString() });
  mergeSetCookies(jar, res.headers);
  const ct = res.headers.get("content-type") ?? "";
  const bytes = new Uint8Array(await res.arrayBuffer());
  console.log(`[mpi] download status=${res.status} ct=${ct} bytes=${bytes.byteLength}`);
  if (!res.ok || bytes.byteLength < 1000) {
    throw new Error(`Download failed: status=${res.status} ct=${ct} size=${bytes.byteLength}`);
  }
  return { bytes, contentType: ct, lotCount: bestLots };
}

// ---------- Session detection ----------

export function isLoginRequired(html: string): boolean {
  if (!html) return true;
  return /type\s*=\s*["']?password/i.test(html) ||
    /fuseaction=dematEnt\.login/i.test(html) && /captcha|connecter|connexion/i.test(html);
}
