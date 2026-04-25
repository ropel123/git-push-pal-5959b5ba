// firecrawlMap.ts
// Wrapper Firecrawl Map (v2) avec filtrage strict pour éviter d'exploser le coût.
// Usage : plateformes où le templating de pagination est impossible (Omnikles, Klekoon, etc.)

const FIRECRAWL_MAP_URL = "https://api.firecrawl.dev/v2/map";

const HARD_CAP_DETAIL_LINKS = 100;
const FIRECRAWL_MAP_LIMIT = 300;

/** Regex des patterns positifs : "ressemble à une page de détail consultation". */
const DETAIL_INCLUDE = /detail|consultation|marche(?:[-_/]|s?$)|dce|refConsult|refPub|idCons|consultId|annonce/i;

/** Regex des patterns négatifs : pages génériques à exclure. */
const DETAIL_EXCLUDE =
  /\b(login|inscription|mentions|cgu|cgv|aide|help|contact|search|recherche|home|accueil|deconnexion|profile|mon-compte)\b|\.(css|js|png|jpe?g|gif|svg|ico|woff2?)$/i;

export type MapResult = {
  links: string[];
  total_found: number;
  total_kept: number;
};

export async function firecrawlMap(
  url: string,
  apiKey: string,
  opts: { search?: string; includeSubdomains?: boolean } = {},
): Promise<MapResult> {
  const resp = await fetch(FIRECRAWL_MAP_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      search: opts.search ?? "consultation",
      limit: FIRECRAWL_MAP_LIMIT,
      includeSubdomains: opts.includeSubdomains ?? false,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Firecrawl map ${resp.status}: ${text.slice(0, 300)}`);
  }

  const payload = await resp.json();
  const allLinks: string[] = payload.links ?? payload.data?.links ?? [];

  const filtered = allLinks
    .filter((l) => DETAIL_INCLUDE.test(l) && !DETAIL_EXCLUDE.test(l))
    .slice(0, HARD_CAP_DETAIL_LINKS);

  return {
    links: filtered,
    total_found: allLinks.length,
    total_kept: filtered.length,
  };
}
