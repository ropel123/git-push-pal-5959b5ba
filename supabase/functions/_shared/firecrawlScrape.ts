// firecrawlScrape.ts
// Wrapper Firecrawl scrape v2 partagé : retry + timeout + extraction structurée IA.

const FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v2/scrape";

export const TENDER_SCHEMA = {
  type: "object",
  properties: {
    tenders: {
      type: "array",
      description: "Liste des consultations / appels d'offres trouvés sur la page.",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          reference: { type: "string" },
          buyer_name: { type: "string" },
          deadline: { type: "string" },
          publication_date: { type: "string" },
          contract_type: { type: "string" },
          procedure_type: { type: "string" },
          estimated_amount: { type: "string" },
          description: { type: "string" },
          location: { type: "string" },
          dce_url: { type: "string" },
        },
        required: ["title"],
      },
    },
  },
  required: ["tenders"],
};

const TENDER_PROMPT = (baseUrl: string) =>
  `Cette page est un portail de marchés publics français. URL de base : ${baseUrl}.

Extrais TOUTES les consultations affichées. Pour chaque ligne : titre/objet, référence (valeur brute, sans préfixes 'réf.','n°'), nom acheteur, date limite (format texte affiché), date publication, type procédure (MAPA/AOO/AOR), type contrat (travaux/services/fournitures), lieu, et URL ABSOLUE vers la page détail.

RÈGLES dce_url :
- Hostname IDENTIQUE à l'URL de base (ou sous-domaine direct).
- Doit contenir un identifiant : refPub=, refConsult=, id=, IDS=, /consultation/, idCons=.
- Résoudre les URLs relatives contre la base.
- N'INVENTE JAMAIS un lien vers boamp.fr / ted.europa.eu.
- Si seul un lien générique est dispo (AllCons, recherche, fuseaction sans refPub), LAISSE dce_url VIDE.

Ignore filtres, pagination, en-têtes. Si rien : tableau vide.`;

export type ScrapeOptions = {
  formats?: Array<string | { type: string; schema?: unknown; prompt?: string }>;
  onlyMainContent?: boolean;
  waitFor?: number;
  timeoutMs?: number;
  retries?: number;
};

export type ScrapeResult = {
  tenders: Array<Record<string, unknown>>;
  links: string[];
  raw_html: string | null;
  markdown: string | null;
};

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch((e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Scrape via Firecrawl avec extraction structurée + links + html (utile au pre-processor). */
export async function firecrawlScrapeStructured(
  url: string,
  apiKey: string,
  opts: { wantHtml?: boolean; timeoutMs?: number; retries?: number } = {},
): Promise<ScrapeResult> {
  const timeoutMs = opts.timeoutMs ?? 25_000;
  const retries = opts.retries ?? 1;

  const formats: Array<string | Record<string, unknown>> = [
    { type: "json", schema: TENDER_SCHEMA, prompt: TENDER_PROMPT(url) },
    "links",
  ];
  if (opts.wantHtml) formats.push("rawHtml");

  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await withTimeout(
        fetch(FIRECRAWL_SCRAPE_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url, formats, onlyMainContent: true, waitFor: 1500 }),
        }),
        timeoutMs,
      );

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        // 5xx → retry, 4xx → throw direct
        if (resp.status >= 500 && attempt < retries) {
          lastErr = new Error(`Firecrawl ${resp.status}`);
          await sleep(1000 * Math.pow(2, attempt));
          continue;
        }
        throw new Error(`Firecrawl ${resp.status}: ${text.slice(0, 300)}`);
      }

      const payload = await resp.json();
      const data = payload.data ?? payload;
      const tenders =
        data?.json?.tenders ??
        data?.extract?.tenders ??
        data?.llm_extraction?.tenders ??
        [];

      return {
        tenders: Array.isArray(tenders) ? tenders : [],
        links: data?.links ?? [],
        raw_html: data?.rawHtml ?? data?.html ?? null,
        markdown: data?.markdown ?? null,
      };
    } catch (e) {
      lastErr = e;
      if (attempt < retries) {
        await sleep(1000 * Math.pow(2, attempt));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
