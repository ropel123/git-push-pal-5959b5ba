// paginationRules.ts
// v2 — règles déclaratives par plateforme (fallback si pas de playbook ou confidence < 0.7)
// L'IA propose, le code décide : ces règles sont la "filet de sécurité" toujours testable.

export type PaginationRule = {
  firstPage: number;
  maxPages: number;
  expectedPageSize: number;
  buildPageUrl: (baseUrl: string, page: number) => string;
};

/** Ajoute ou remplace un paramètre GET, en gérant ;jsessionid=… et fragments. */
export function addParam(url: string, key: string, value: string | number): string {
  // Sépare le fragment
  const [withQuery, fragment] = url.split("#");
  // Sépare un éventuel ;jsessionid=…
  const semiIdx = withQuery.search(/;jsessionid=/i);
  const base = semiIdx === -1 ? withQuery : withQuery.slice(0, semiIdx);
  const sessionPart = semiIdx === -1 ? "" : withQuery.slice(semiIdx).replace(/\?.*$/, "");
  const queryStart = base.indexOf("?");
  const path = queryStart === -1 ? base : base.slice(0, queryStart);
  const query = queryStart === -1 ? "" : base.slice(queryStart + 1);

  const params = new URLSearchParams(query);
  params.set(key, String(value));

  let out = path;
  if (sessionPart) out += sessionPart;
  const qs = params.toString();
  if (qs) out += "?" + qs;
  if (fragment) out += "#" + fragment;
  return out;
}

export const PAGINATION_RULES: Record<string, PaginationRule> = {
  atexo: {
    firstPage: 1,
    maxPages: 20,
    expectedPageSize: 10,
    buildPageUrl: (u, p) => addParam(u, "PageNumber", p),
  },
  achatpublic: {
    firstPage: 1,
    maxPages: 20,
    expectedPageSize: 10,
    buildPageUrl: (u, p) => addParam(u, "pageNumber", p),
  },
  mpi: {
    firstPage: 1,
    maxPages: 30,
    expectedPageSize: 10,
    buildPageUrl: (u, p) => addParam(u, "page", p),
  },
  "marches-securises": {
    firstPage: 1,
    maxPages: 20,
    expectedPageSize: 10,
    buildPageUrl: (u, p) => addParam(u, "page", p),
  },
  "eu-supply": {
    firstPage: 1,
    maxPages: 20,
    expectedPageSize: 10,
    buildPageUrl: (u, p) => addParam(u, "page", p),
  },
  maximilien: {
    firstPage: 1,
    maxPages: 20,
    expectedPageSize: 10,
    buildPageUrl: (u, p) => addParam(u, "PageNumber", p),
  },
  "e-marchespublics": {
    firstPage: 1,
    maxPages: 30,
    expectedPageSize: 10,
    buildPageUrl: (u, p) => {
      // pattern ..._aapc_________1.html → _N.html
      if (/_(\d+)\.html$/i.test(u)) return u.replace(/_(\d+)\.html$/i, `_${p}.html`);
      return addParam(u, "page", p);
    },
  },
  francemarches: {
    firstPage: 1,
    maxPages: 30,
    expectedPageSize: 10,
    buildPageUrl: (u, p) =>
      p === 1 ? u : u.replace(/\/?$/, `/page/${p}/`),
  },
};

export const MAP_BASED_PLATFORMS = new Set([
  "omnikles",
  "safetender",
  "klekoon",
  "aji",
  "domino",
  "aura",
  "xmarches",
  "ternum",
]);

/** Empreinte stable d'un item pour dédup. */
export function fingerprint(item: {
  reference?: string;
  dce_url?: string;
  title?: string;
  buyer_name?: string;
  deadline?: string;
}): string {
  if (item.reference && item.reference.trim().length > 2) return `ref:${item.reference.trim().toLowerCase()}`;
  if (item.dce_url && item.dce_url.trim().length > 5) return `url:${item.dce_url.trim().toLowerCase()}`;
  const fallback = `${item.title || ""}|${item.buyer_name || ""}|${item.deadline || ""}`
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return `tit:${fallback}`;
}

export async function sha1(str: string): Promise<string> {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
