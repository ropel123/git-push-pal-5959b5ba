// Fetch HTML brut d'une page de marchés publics.
// La classification proprement dite est désormais faite par aiClassifier.ts (Claude via OpenRouter).
// Ce module ne fait QUE le téléchargement (1 GET, 8 KB max retournés).

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 500_000; // on lit jusqu'à 500 KB pour avoir de la matière, on retourne 8 KB à l'IA en aval

export type HtmlFetchResult = {
  ok: boolean;
  html: string;          // tronqué (head + 8 KB body)
  headers: Headers;      // headers de la réponse finale (après redirects)
  status: number;
  error?: string;
};

function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, {
    method: "GET",
    redirect: "follow",
    signal: ctrl.signal,
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; HackifyBot/1.0; +https://hackify.fr)",
      "Accept": "text/html,application/xhtml+xml",
    },
  }).finally(() => clearTimeout(timer));
}

/**
 * Télécharge le HTML d'une URL et retourne head + extrait pour classification IA.
 * Stratégie : on garde le <head> en entier (signatures meta/script utiles)
 * + les 8 premiers KB du <body>.
 */
export async function fetchHtmlForClassification(url: string): Promise<HtmlFetchResult> {
  try {
    const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
    const text = await res.text();
    const truncated = text.slice(0, MAX_BYTES);

    // Extraction head + début body
    const headMatch = truncated.match(/<head[^>]*>[\s\S]*?<\/head>/i);
    const bodyMatch = truncated.match(/<body[^>]*>([\s\S]*?)(?:<\/body>|$)/i);

    const head = headMatch ? headMatch[0] : truncated.slice(0, 4000);
    const bodyStart = bodyMatch ? bodyMatch[1].slice(0, 8000) : truncated.slice(0, 8000);

    const html = `${head}\n<!-- BODY EXTRACT -->\n${bodyStart}`;

    return {
      ok: res.ok,
      html,
      headers: res.headers,
      status: res.status,
    };
  } catch (err) {
    return {
      ok: false,
      html: "",
      headers: new Headers(),
      status: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
