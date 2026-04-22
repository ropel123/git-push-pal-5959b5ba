// Détection de plateforme par sonde HTTP/HTML.
// Inspecte headers (server, x-powered-by, set-cookie) puis HTML brut (regex sur signatures uniques).
// Retourne { platform, confidence, evidence } pour audit dans l'UI.

export type FingerprintResult = {
  platform: string;
  confidence: number;
  evidence: string[];
};

const FETCH_TIMEOUT_MS = 8000;

const HTML_SIGNATURES: Array<{ pattern: RegExp; platform: string; tag: string; weight: number }> = [
  // Atexo (toutes versions)
  { pattern: /<meta\s+name=["']generator["']\s+content=["'][^"']*atexo[^"']*["']/i, platform: "atexo", tag: "html:meta-generator-atexo", weight: 1.0 },
  { pattern: /\/atexo-mpe\//i, platform: "atexo", tag: "html:/atexo-mpe/", weight: 0.95 },
  { pattern: /\/app_atexo\//i, platform: "atexo", tag: "html:/app_atexo/", weight: 0.95 },
  { pattern: /atexoStatic/i, platform: "atexo", tag: "html:atexoStatic", weight: 0.9 },
  { pattern: /class=["']atxLogo["']/i, platform: "atexo", tag: "html:atxLogo", weight: 0.85 },
  { pattern: /favicon-mpe\.ico/i, platform: "atexo", tag: "html:favicon-mpe", weight: 0.8 },
  { pattern: /\/sdm\/ent2\/gen\/[a-zA-Z]+\.action/i, platform: "atexo", tag: "html:sdm-ent2-action", weight: 0.95 },
  // MPI / ColdFusion
  { pattern: /fuseaction=entreprise\.AllCons/i, platform: "mpi", tag: "html:fuseaction=entreprise", weight: 0.95 },
  { pattern: /index\.cfm\?fuseaction=/i, platform: "mpi", tag: "html:index.cfm", weight: 0.9 },
  // PLACE
  { pattern: /window\.PLACE_CONFIG/i, platform: "place", tag: "html:PLACE_CONFIG", weight: 0.95 },
  { pattern: /place_logo/i, platform: "place", tag: "html:place_logo", weight: 0.7 },
  // SafeTender STRICT — uniquement script ou asset explicite
  { pattern: /<script[^>]*src=["'][^"']*safetender[^"']*["']/i, platform: "safetender", tag: "html:script-safetender", weight: 0.95 },
  // achatpublic
  { pattern: /data-app=["']achatpublic["']/i, platform: "achatpublic", tag: "html:data-app-achatpublic", weight: 0.95 },
  // Klekoon
  { pattern: /class=["'][^"']*klk-/i, platform: "klekoon", tag: "html:klk-class", weight: 0.85 },
  { pattern: /klekoon-/i, platform: "klekoon", tag: "html:klekoon-", weight: 0.8 },
];

const COOKIE_SIGNATURES: Array<{ name: string; platform: string; weight: number }> = [
  { name: "ATEXO_SESSID", platform: "atexo", weight: 1.0 },
  { name: "PLACE_SESSION", platform: "place", weight: 1.0 },
  // CFID/CFTOKEN/JSESSIONID sont génériques — signal faible, n'en faisons rien seul
];

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

export async function detectPlatformByFingerprint(url: string): Promise<FingerprintResult> {
  const evidence: string[] = [];
  const scores: Record<string, number> = {};

  const bump = (platform: string, weight: number, tag: string) => {
    scores[platform] = (scores[platform] ?? 0) + weight;
    evidence.push(tag);
  };

  try {
    const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);

    // 1. Headers
    const server = res.headers.get("server") ?? "";
    const xpb = res.headers.get("x-powered-by") ?? "";
    const setCookie = res.headers.get("set-cookie") ?? "";

    if (/atexo/i.test(server)) bump("atexo", 0.9, `header:server:${server.slice(0, 40)}`);
    if (/asp\.net/i.test(xpb)) bump("mpi", 0.5, `header:x-powered-by:${xpb.slice(0, 40)}`);

    for (const c of COOKIE_SIGNATURES) {
      if (setCookie.includes(c.name)) bump(c.platform, c.weight, `cookie:${c.name}`);
    }

    // 2. HTML body (max 500KB pour éviter les pages géantes)
    const text = await res.text();
    const html = text.slice(0, 500_000);

    for (const sig of HTML_SIGNATURES) {
      if (sig.pattern.test(html)) bump(sig.platform, sig.weight, sig.tag);
    }

    // Choix du gagnant
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
      return { platform: "custom", confidence: 0, evidence: ["no-signal"] };
    }
    const [platform, score] = entries[0];
    const confidence = Math.min(1, score / 1.5);
    return { platform, confidence, evidence };
  } catch (err) {
    return {
      platform: "custom",
      confidence: 0,
      evidence: [`error:${err instanceof Error ? err.message : String(err)}`],
    };
  }
}
