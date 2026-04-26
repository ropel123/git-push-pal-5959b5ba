// atexoDetailParser.ts
// Fetches and parses an Atexo/PRADO consultation detail page.
//
// The list page (?page=Entreprise.EntrepriseAdvancedSearch&AllCons) only
// renders the "actions" column server-side; the title/buyer/dates columns
// are injected by JS at runtime, so they are NOT in the raw HTML.
//
// The detail page /entreprise/consultation/{id} however renders the full
// label/value table in plain HTML:
//
//   Date et heure limite de remise des plis : 30/04/2026 12:00
//   Référence :                                2026-M0660001-00
//   Intitulé :                                 MISSIONS DE FORMATION ...
//   Objet :                                    Limoges Métropole, ...
//   Organisme :                                LIMOGES MÉTROPOLE - ...
//
// We GET that page (reusing the PRADO session cookies) and extract
// each labelled field with regex.

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export type AtexoDetail = {
  title?: string;
  object?: string;
  buyer_name?: string;
  deadline?: string;            // ISO if parseable, else raw FR text
  publication_date?: string;    // YYYY-MM-DD
  reference?: string;
  procedure_type?: string;
  contract_type?: string;
  cpv_codes?: string[];
  dce_url: string;
  _detail_status: number;
  _matched_fields: number;
};

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&laquo;/gi, "«")
    .replace(/&raquo;/gi, "»")
    .replace(/&eacute;/gi, "é")
    .replace(/&egrave;/gi, "è")
    .replace(/&ecirc;/gi, "ê")
    .replace(/&agrave;/gi, "à")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&ocirc;/gi, "ô")
    .replace(/&icirc;/gi, "î")
    .replace(/&ucirc;/gi, "û");
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ");
}

function clean(s: string | undefined | null): string | undefined {
  if (!s) return undefined;
  const out = decodeEntities(stripTags(s)).replace(/\s+/g, " ").trim();
  return out.length > 0 ? out : undefined;
}

/**
 * Match a label-then-value pair in the Atexo detail "table".
 * The structure is roughly:
 *   <... class="intitule">Label :</...>
 *   <... class="contenu">Value</...>
 *
 * We accept up to ~600 chars between label and the next opening tag, then
 * capture content until the next closing tag at the same level.
 */
function extractByLabel(html: string, label: string, maxLen = 3000): string | undefined {
  // Escape the label for regex (handles accents fine since we operate on raw HTML)
  const labelEsc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match: label, optional " :", then SOMETHING in a tag (the value cell)
  const re = new RegExp(
    `${labelEsc}\\s*:?\\s*<\\/[^>]+>\\s*<[^>]+>([\\s\\S]{1,${maxLen}}?)<\\/`,
    "i",
  );
  const m = html.match(re);
  if (m) return clean(m[1]);

  // Fallback: label inside a single tag, value in the next sibling tag
  const re2 = new RegExp(
    `>${labelEsc}\\s*:?\\s*<[\\s\\S]{0,200}?<[^>]+>([\\s\\S]{1,${maxLen}}?)<`,
    "i",
  );
  const m2 = html.match(re2);
  if (m2) return clean(m2[1]);

  // Last fallback: label followed by raw text (no tag in between)
  const re3 = new RegExp(`${labelEsc}\\s*:\\s*([^<\\n]{1,${maxLen}})`, "i");
  const m3 = html.match(re3);
  if (m3) return clean(m3[1]);

  return undefined;
}

/** Parse "30/04/2026 12:00" or "30/04/2026" → ISO. */
function parseFrenchDateTime(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const m = raw.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) return undefined;
  const [, dd, mm, yyyy, hh = "00", mi = "00"] = m;
  // Atexo affiche en heure locale FR; on encode en UTC approximatif (offset géré côté affichage).
  return `${yyyy}-${mm}-${dd}T${hh.padStart(2, "0")}:${mi}:00Z`;
}

function detectProcedureType(html: string): string | undefined {
  const blob = stripTags(html).slice(0, 30_000);
  if (/proc[ée]dure adapt[ée]e/i.test(blob) || /\bMAPA\b/.test(blob)) return "MAPA";
  if (/appel d'offres ouvert/i.test(blob) || /\bAOO\b/.test(blob)) return "AOO";
  if (/appel d'offres restreint/i.test(blob) || /\bAOR\b/.test(blob)) return "AOR";
  if (/dialogue comp[ée]titif/i.test(blob)) return "DC";
  if (/march[ée] n[ée]goci[ée]/i.test(blob)) return "MN";
  return undefined;
}

function detectContractType(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const t = text.toLowerCase();
  if (/\btravaux\b/.test(t)) return "travaux";
  if (/\bfourniture/.test(t)) return "fournitures";
  if (/\bservice/.test(t)) return "services";
  return undefined;
}

function extractCpvCodes(html: string): string[] {
  const codes = new Set<string>();
  // CPV codes are 8 digits, often followed by "-N" check digit
  const re = /\b(\d{8})(?:-\d)?\b/g;
  const blob = stripTags(html);
  let m: RegExpExecArray | null;
  while ((m = re.exec(blob)) !== null) {
    // Filter out years, phone numbers, etc. CPV codes are 8 digits and don't
    // start with 19/20 (years) or 0.
    const code = m[1];
    if (code.startsWith("19") || code.startsWith("20") || code.startsWith("0")) continue;
    codes.add(code);
  }
  return Array.from(codes).slice(0, 10);
}

/**
 * GET the Atexo consultation detail page and parse the labelled fields.
 * Reuses the cookie jar from the PRADO list session to avoid being
 * redirected to the login page.
 */
export async function fetchAtexoDetail(
  id: string,
  baseHost: string,
  cookies: string,
  signal?: AbortSignal,
): Promise<AtexoDetail> {
  const url = `${baseHost}/entreprise/consultation/${id}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": USER_AGENT,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      ...(cookies ? { Cookie: cookies } : {}),
    },
    redirect: "follow",
    signal,
  });

  const html = await res.text();

  // If we got bounced to login or home, no labels will match — return empty.
  const out: AtexoDetail = {
    dce_url: url,
    _detail_status: res.status,
    _matched_fields: 0,
  };

  if (res.status >= 400 || html.length < 1000) {
    return out;
  }

  // Title — try several label variants Atexo uses across versions
  const title =
    extractByLabel(html, "Intitulé", 1000) ||
    extractByLabel(html, "Intitulé de la consultation", 1000) ||
    extractByLabel(html, "Intitule", 1000);
  if (title) {
    out.title = title;
    out._matched_fields++;
  }

  const object =
    extractByLabel(html, "Objet de la consultation", 5000) ||
    extractByLabel(html, "Objet", 5000) ||
    extractByLabel(html, "Description", 5000);
  if (object) {
    out.object = object;
    out._matched_fields++;
  }

  const buyer =
    extractByLabel(html, "Organisme", 500) ||
    extractByLabel(html, "Entité publique", 500) ||
    extractByLabel(html, "Acheteur", 500) ||
    extractByLabel(html, "Entité d'achat", 500);
  if (buyer) {
    out.buyer_name = buyer;
    out._matched_fields++;
  }

  const reference =
    extractByLabel(html, "Référence", 200) ||
    extractByLabel(html, "Reference", 200);
  if (reference) {
    out.reference = reference;
    out._matched_fields++;
  }

  const deadlineRaw =
    extractByLabel(html, "Date et heure limite de remise des plis", 200) ||
    extractByLabel(html, "Date limite de remise des plis", 200) ||
    extractByLabel(html, "Date limite de réception des offres", 200) ||
    extractByLabel(html, "Date limite", 200);
  const deadline = parseFrenchDateTime(deadlineRaw);
  if (deadline) {
    out.deadline = deadline;
    out._matched_fields++;
  } else if (deadlineRaw) {
    out.deadline = deadlineRaw;
  }

  const pubRaw =
    extractByLabel(html, "Date de mise en ligne", 200) ||
    extractByLabel(html, "Date de publication", 200) ||
    extractByLabel(html, "Mise en ligne le", 200);
  const pub = parseFrenchDateTime(pubRaw);
  if (pub) {
    out.publication_date = pub.slice(0, 10);
    out._matched_fields++;
  }

  const procedure = detectProcedureType(html);
  if (procedure) out.procedure_type = procedure;

  const contract = detectContractType(`${out.title ?? ""} ${out.object ?? ""}`);
  if (contract) out.contract_type = contract;

  const cpv = extractCpvCodes(html);
  if (cpv.length > 0) out.cpv_codes = cpv;

  return out;
}

/**
 * Concurrency-controlled enrichment: fetch detail pages for many IDs in
 * parallel with a fixed pool size and a global time budget.
 */
export async function enrichDetailsBatch(
  ids: string[],
  baseHost: string,
  cookies: string,
  opts: {
    poolSize?: number;
    perFetchTimeoutMs?: number;
    globalBudgetMs?: number;
    onResult?: (id: string, detail: AtexoDetail | null) => void;
  } = {},
): Promise<{
  results: Map<string, AtexoDetail>;
  fetched: number;
  failed: number;
  elapsedMs: number;
  matchRate: number;
}> {
  const poolSize = opts.poolSize ?? 6;
  const perFetchTimeoutMs = opts.perFetchTimeoutMs ?? 8_000;
  const globalBudgetMs = opts.globalBudgetMs ?? 60_000;

  const results = new Map<string, AtexoDetail>();
  let fetched = 0;
  let failed = 0;
  let totalMatched = 0;
  const startTime = Date.now();
  const queue = [...ids];

  async function worker() {
    while (queue.length > 0) {
      if (Date.now() - startTime > globalBudgetMs) return;
      const id = queue.shift();
      if (!id) return;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), perFetchTimeoutMs);
      try {
        const detail = await fetchAtexoDetail(id, baseHost, cookies, ctrl.signal);
        clearTimeout(timer);
        results.set(id, detail);
        totalMatched += detail._matched_fields;
        if (detail._matched_fields > 0) fetched++;
        else failed++;
        opts.onResult?.(id, detail);
      } catch {
        clearTimeout(timer);
        failed++;
        opts.onResult?.(id, null);
      }
    }
  }

  const workers = Array.from({ length: poolSize }, () => worker());
  await Promise.all(workers);

  const elapsedMs = Date.now() - startTime;
  const matchRate = ids.length > 0 ? totalMatched / (ids.length * 5) : 0; // 5 main fields
  return { results, fetched, failed, elapsedMs, matchRate };
}
