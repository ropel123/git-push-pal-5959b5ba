// pradoClient.ts
// Stateful HTTP client for PRADO-based platforms (Atexo / alsacemarchespublics / etc.)
//
// PRADO is a PHP framework with stateful postbacks similar to ASP.NET WebForms:
//  - hidden field PRADO_PAGESTATE carries server-side ViewState
//  - hidden field _csrf_token must be replayed
//  - cookies (PHPSESSID...) must be persisted across requests
//  - pagination = POST with PRADO_POSTBACK_TARGET = next-button event target
//
// Strict rules implemented here:
//  1. State chaining: postEvent consumes a FormState, returns a NEW FormState
//     extracted from the response. Callers MUST use the new state on the next call.
//  2. Cookies jar persisted across the chain (Set-Cookie merged in).
//  3. ALL hidden inputs from the form are re-submitted (not just pagestate/csrf).
//  4. No gotoPage — only event-chain (next button) is exposed.

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export type FormState = {
  /** Absolute action URL (where to POST). */
  url: string;
  /** Cookie header value (already serialized as "k=v; k=v"). */
  cookies: string;
  /** All hidden inputs from the form, name → value. */
  hiddenInputs: Map<string, string>;
  /** PRADO_PAGESTATE convenience accessor (also present in hiddenInputs). */
  pageState: string | null;
  /** _csrf_token convenience accessor (also present in hiddenInputs). */
  csrfToken: string | null;
  /** Last HTML payload (kept for debugging / next-event extraction). */
  lastHtml: string;
};

export type FetchPageResult = {
  html: string;
  state: FormState;
  status: number;
};

// -------------------------------------------------------------------- helpers

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Parse Set-Cookie headers and merge into a cookie jar (name → value). */
function mergeSetCookies(jar: Map<string, string>, response: Response): void {
  // Deno's Headers.getSetCookie() is the spec-compliant way (multiple cookies).
  // Fallback to raw 'set-cookie' header parsing for older runtimes.
  // deno-lint-ignore no-explicit-any
  const getSetCookie = (response.headers as any).getSetCookie?.bind(response.headers);
  const raw: string[] = getSetCookie ? getSetCookie() : [];
  if (raw.length === 0) {
    const single = response.headers.get("set-cookie");
    if (single) raw.push(single);
  }
  for (const line of raw) {
    // "name=value; Path=/; HttpOnly; ..." → take only the first key=value
    const firstSemi = line.indexOf(";");
    const kv = firstSemi === -1 ? line : line.slice(0, firstSemi);
    const eq = kv.indexOf("=");
    if (eq === -1) continue;
    const name = kv.slice(0, eq).trim();
    const value = kv.slice(eq + 1).trim();
    if (!name) continue;
    // Empty value = delete cookie
    if (value === "" || value === "deleted") {
      jar.delete(name);
    } else {
      jar.set(name, value);
    }
  }
}

function jarToHeader(jar: Map<string, string>): string {
  const parts: string[] = [];
  for (const [k, v] of jar) parts.push(`${k}=${v}`);
  return parts.join("; ");
}

function jarFromHeader(header: string): Map<string, string> {
  const jar = new Map<string, string>();
  if (!header) return jar;
  for (const part of header.split(";")) {
    const kv = part.trim();
    const eq = kv.indexOf("=");
    if (eq === -1) continue;
    jar.set(kv.slice(0, eq).trim(), kv.slice(eq + 1).trim());
  }
  return jar;
}

/** Resolve an action attribute (relative or absolute) against a base URL. */
function resolveActionUrl(action: string, baseUrl: string): string {
  try {
    return new URL(decodeEntities(action), baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

// ---------------------------------------------------------- HTML extraction

const FORM_OPEN_RE = /<form\b[^>]*>/gi;
const FORM_ACTION_RE = /\baction=["']([^"']+)["']/i;
const FORM_METHOD_RE = /\bmethod=["']post["']/i;
const FORM_NAME_RE = /\bname=["']([^"']+)["']/i;
const FORM_ID_RE = /\bid=["']([^"']+)["']/i;
// Match ANY <input ...> tag (hidden, text, etc.) — PRADO's PRADO_PAGESTATE
// uses type="text" with style="display:none", so we can't filter on type.
// We rely on the form scope + a name attribute to decide what to replay.
const ANY_INPUT_RE = /<input\b[^>]*>/gi;
const SELECT_RE = /<select\b([^>]*)>([\s\S]*?)<\/select>/gi;
const TEXTAREA_RE = /<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/gi;
const SELECTED_OPTION_RE = /<option\b[^>]*\bselected\b[^>]*\bvalue=["']([^"']*)["']/i;
const FIRST_OPTION_RE = /<option\b[^>]*\bvalue=["']([^"']*)["']/i;
const INPUT_NAME_RE = /\bname=["']([^"']+)["']/i;
const INPUT_VALUE_RE = /\bvalue=["']([^"']*)["']/i;
const INPUT_TYPE_RE = /\btype=["']([^"']+)["']/i;
const INPUT_CHECKED_RE = /\bchecked\b/i;

/**
 * Find the main PRADO form. Multiple forms can coexist (login form, search box, etc.).
 * Selection priority:
 *   1. POST form whose name == "main_form" (PRADO convention)
 *   2. POST form whose action contains "?page=" (PRADO routing)
 *   3. Largest POST form by inner-HTML length
 */
function findMainPostForm(html: string): { tag: string; inner: string } | null {
  const candidates: Array<{ tag: string; inner: string; score: number }> = [];
  let m: RegExpExecArray | null;
  FORM_OPEN_RE.lastIndex = 0;
  while ((m = FORM_OPEN_RE.exec(html)) !== null) {
    const tag = m[0];
    if (!FORM_METHOD_RE.test(tag)) continue;
    const innerStart = m.index + tag.length;
    const closeIdx = html.indexOf("</form>", innerStart);
    if (closeIdx === -1) continue;
    const inner = html.slice(innerStart, closeIdx);
    const nameMatch = tag.match(FORM_NAME_RE);
    const idMatch = tag.match(FORM_ID_RE);
    const actionMatch = tag.match(FORM_ACTION_RE);
    let score = 0;
    if (nameMatch?.[1] === "main_form") score += 1000;
    if (idMatch?.[1]?.startsWith("ctl")) score += 500;
    if (actionMatch?.[1]?.includes("?page=")) score += 200;
    if (actionMatch?.[1]?.includes("/login")) score -= 1000;
    score += Math.min(inner.length / 100, 100);
    candidates.push({ tag, inner, score });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return { tag: candidates[0].tag, inner: candidates[0].inner };
}

/**
 * Extract every named input/select/textarea inside the main PRADO form.
 * Browsers serialize ALL named form fields on submit — we must do the same.
 *
 * Skipped:
 *  - inputs without a name (decorative)
 *  - submit/button/image/reset/file inputs (postbacks via PRADO_POSTBACK_TARGET)
 *  - unchecked checkboxes/radios (browsers omit them)
 */
export function extractFormState(html: string, baseUrl: string): FormState {
  const form = findMainPostForm(html);
  const formInner = form?.inner ?? html;
  const formTag = form?.tag ?? "";
  const actionMatch = formTag.match(FORM_ACTION_RE);
  const actionUrl = actionMatch ? resolveActionUrl(actionMatch[1], baseUrl) : baseUrl;

  const hiddenInputs = new Map<string, string>();

  // 1. <input> — all types except submit/button/image
  ANY_INPUT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ANY_INPUT_RE.exec(formInner)) !== null) {
    const tag = m[0];
    const nameMatch = tag.match(INPUT_NAME_RE);
    if (!nameMatch) continue;
    const name = decodeEntities(nameMatch[1]);
    const typeMatch = tag.match(INPUT_TYPE_RE);
    const type = (typeMatch?.[1] ?? "text").toLowerCase();
    if (type === "submit" || type === "button" || type === "image" || type === "reset" || type === "file") continue;
    if ((type === "checkbox" || type === "radio") && !INPUT_CHECKED_RE.test(tag)) continue;
    const valueMatch = tag.match(INPUT_VALUE_RE);
    const value = valueMatch
      ? decodeEntities(valueMatch[1])
      : (type === "checkbox" || type === "radio" ? "on" : "");
    hiddenInputs.set(name, value);
  }

  // 2. <select> — take the selected option (or first if none selected)
  SELECT_RE.lastIndex = 0;
  while ((m = SELECT_RE.exec(formInner)) !== null) {
    const attrs = m[1];
    const inner = m[2];
    const nameMatch = attrs.match(INPUT_NAME_RE);
    if (!nameMatch) continue;
    const name = decodeEntities(nameMatch[1]);
    const sel = inner.match(SELECTED_OPTION_RE) ?? inner.match(FIRST_OPTION_RE);
    const value = sel ? decodeEntities(sel[1]) : "";
    if (!hiddenInputs.has(name)) hiddenInputs.set(name, value);
  }

  // 3. <textarea>
  TEXTAREA_RE.lastIndex = 0;
  while ((m = TEXTAREA_RE.exec(formInner)) !== null) {
    const attrs = m[1];
    const inner = m[2];
    const nameMatch = attrs.match(INPUT_NAME_RE);
    if (!nameMatch) continue;
    const name = decodeEntities(nameMatch[1]);
    if (!hiddenInputs.has(name)) hiddenInputs.set(name, decodeEntities(inner));
  }

  return {
    url: actionUrl,
    cookies: "",
    hiddenInputs,
    pageState: hiddenInputs.get("PRADO_PAGESTATE") ?? null,
    csrfToken: hiddenInputs.get("_csrf_token") ?? null,
    lastHtml: html,
  };
}

/** Extract the EventTarget for the "next page" pager link (PRADO TLinkButton). */
export function extractNextPagerEventTarget(html: string): string | null {
  // Look for the "page suivante" anchor and read its id, then find matching
  // Prado.WebUI.TLinkButton({'ID': "<id>", 'EventTarget': "<target>"})
  // We use the anchor's id as the link between markup and JS init.
  const anchorRe =
    /<a\s+id="([^"]+)"[^>]*>\s*<span[^>]*title=['"]Aller à la page suivante['"]/i;
  const anchorMatch = html.match(anchorRe);
  if (!anchorMatch) return null;
  const anchorId = anchorMatch[1];

  // Build a regex to find this anchor's TLinkButton init
  const idEsc = anchorId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tlinkRe = new RegExp(
    `TLinkButton\\(\\{[^}]*['"]ID['"]\\s*:\\s*["']${idEsc}["'][^}]*['"]EventTarget['"]\\s*:\\s*["']([^"']+)["']`,
    "i",
  );
  const tlinkMatch = html.match(tlinkRe);
  if (tlinkMatch) return decodeEntities(tlinkMatch[1]);

  // Fallback: derive from id by replacing _ with $ at the right places.
  // Pattern observed: ctl0_CONTENU_PAGE_resultSearch_PagerBottom_ctl2
  //              →  ctl0$CONTENU_PAGE$resultSearch$PagerBottom$ctl2
  // (Atexo/PRADO uses $ as separator in name, _ in id — same path.)
  return anchorId.replace(/_/g, "$");
}

/** Extract consultation IDs visible in the HTML. */
export function extractIdsFromHtml(html: string): string[] {
  const ids = new Set<string>();
  const re = /\/entreprise\/consultation\/(\d+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) ids.add(m[1]);
  return Array.from(ids);
}

/** Extract total page count: "1 / 18" appears next to the numPageBottom input. */
export function extractTotalPages(html: string): number {
  // Look for "/ N" right after the numPageBottom input block
  const ctxRe = /numPage(?:Bottom|Top)[\s\S]{0,400}?\/\s*(\d+)/i;
  const m = html.match(ctxRe);
  if (m) return Math.max(1, parseInt(m[1], 10));
  // Fallback: <span ...nombrePageBottom>N</span>
  const m2 = html.match(/nombrePage(?:Bottom|Top)["'][^>]*>\s*(\d+)\s*</i);
  if (m2) return Math.max(1, parseInt(m2[1], 10));
  return 1;
}

/** Extract the "page courante" (numPageBottom value) — for sanity checks. */
export function extractCurrentPage(html: string): number {
  const m = html.match(/numPageBottom["'][^>]*\bvalue=["'](\d+)["']/i);
  return m ? parseInt(m[1], 10) : 1;
}

// ------------------------------------------------------------------ requests

function defaultHeaders(url: string, cookies: string, isPost: boolean): HeadersInit {
  const u = new URL(url);
  const h: Record<string, string> = {
    "User-Agent": USER_AGENT,
    "Accept":
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
  };
  if (cookies) h["Cookie"] = cookies;
  if (isPost) {
    h["Content-Type"] = "application/x-www-form-urlencoded";
    h["Origin"] = `${u.protocol}//${u.host}`;
    h["Referer"] = url;
    // PRADO callbacks set this — helps the framework take the postback path
    h["X-Requested-With"] = "XMLHttpRequest";
    h["X-PRADO-PAGESTATE"] = "true";
  }
  return h;
}

/** GET the initial page and capture state + cookies. */
export async function fetchInitialPage(
  url: string,
  signal?: AbortSignal,
): Promise<FetchPageResult> {
  const jar = new Map<string, string>();
  const res = await fetch(url, {
    method: "GET",
    headers: defaultHeaders(url, "", false),
    redirect: "follow",
    signal,
  });
  mergeSetCookies(jar, res);
  const html = await res.text();
  const state = extractFormState(html, url);
  state.cookies = jarToHeader(jar);
  return { html, state, status: res.status };
}

/**
 * POST a PRADO event (next page). Consumes a FormState, returns the NEW state
 * extracted from the response (state chaining is mandatory).
 */
export async function postEvent(
  state: FormState,
  eventTarget: string,
  eventParameter = "",
  signal?: AbortSignal,
): Promise<FetchPageResult> {
  const body = new URLSearchParams();
  // 1. PRADO postback markers (must come first or alongside other fields)
  body.set("PRADO_POSTBACK_TARGET", eventTarget);
  body.set("PRADO_POSTBACK_PARAMETER", eventParameter);
  // 2. ALL hidden inputs replayed verbatim
  for (const [k, v] of state.hiddenInputs) {
    // Don't override the postback markers if they appeared as hidden too
    if (k === "PRADO_POSTBACK_TARGET" || k === "PRADO_POSTBACK_PARAMETER") continue;
    body.set(k, v);
  }

  const jar = jarFromHeader(state.cookies);
  const res = await fetch(state.url, {
    method: "POST",
    headers: defaultHeaders(state.url, state.cookies, true),
    body: body.toString(),
    redirect: "follow",
    signal,
  });
  mergeSetCookies(jar, res);
  const html = await res.text();

  // STATE CHAINING: build a fresh state from the response
  const newState = extractFormState(html, state.url);
  newState.cookies = jarToHeader(jar);

  return { html, state: newState, status: res.status };
}

/** Detect whether a given HTML is served by the PRADO engine. */
export function isPradoHtml(html: string): boolean {
  return (
    html.includes('name="PRADO_PAGESTATE"') &&
    /Prado\.WebUI\.TLinkButton/.test(html)
  );
}
