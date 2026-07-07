// _shared/urlGuard.ts — protection SSRF pour les fetch d'URL fournies par
// l'utilisateur : protocole http(s) uniquement, blocage des hôtes internes,
// des IP privées (littérales et résolues via DNS), redirections revalidées.

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal"]);
const BLOCKED_SUFFIXES = [".local", ".internal", ".localdomain"];

const PRIVATE_V4_PATTERNS = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.0\.0\./,
  /^192\.168\./,
  /^198\.1[89]\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];

function isPrivateIpv4(ip: string): boolean {
  return PRIVATE_V4_PATTERNS.some((p) => p.test(ip));
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (lower === "::" || lower === "::1") return true;
  // fc00::/7 (ULA), fe80::/10 (link-local), fec0::/10 (site-local déprécié)
  if (/^f[cd]/.test(lower) || /^fe[89ab]/.test(lower) || /^fec/.test(lower)) return true;
  // IPv4 mappée : ::ffff:a.b.c.d
  const v4 = lower.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4) return isPrivateIpv4(v4[1]);
  return false;
}

function isIpLiteral(hostname: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":");
}

function isPrivateIp(ip: string): boolean {
  return ip.includes(":") ? isPrivateIpv6(ip) : isPrivateIpv4(ip);
}

/**
 * Valide qu'une URL pointe vers un hôte public. Lance une erreur sinon.
 * Retourne l'URL normalisée (https:// ajouté si absent).
 */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let input = raw.trim();
  const schemeMatch = input.match(/^([a-z][a-z0-9+.-]*):/i);
  if (schemeMatch) {
    // Un schéma explicite non http(s) (file:, ftp:, gopher:…) est refusé
    // plutôt que réécrit, pour éviter tout contournement.
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme !== "http" && scheme !== "https") {
      throw new Error("Seuls les protocoles http et https sont autorisés");
    }
  } else {
    input = `https://${input}`;
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("URL invalide");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Seuls les protocoles http et https sont autorisés");
  }
  if (url.username || url.password) {
    throw new Error("URL avec identifiants non autorisée");
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(hostname) || BLOCKED_SUFFIXES.some((s) => hostname.endsWith(s))) {
    throw new Error("Hôte non autorisé");
  }

  if (isIpLiteral(hostname)) {
    if (isPrivateIp(hostname)) throw new Error("Adresse IP privée non autorisée");
    return url;
  }

  // Résolution DNS pour bloquer les domaines pointant vers le réseau interne.
  // Si la résolution n'est pas permise par le runtime, on garde les gardes
  // hostname/IP littérale ci-dessus.
  try {
    const [a, aaaa] = await Promise.all([
      Deno.resolveDns(hostname, "A").catch(() => [] as string[]),
      Deno.resolveDns(hostname, "AAAA").catch(() => [] as string[]),
    ]);
    const ips = [...a, ...aaaa];
    if (ips.some(isPrivateIp)) {
      throw new Error("Le domaine résout vers une adresse privée");
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("adresse privée")) throw e;
    console.warn("[urlGuard] resolveDns indisponible, garde DNS ignorée:", e);
  }

  return url;
}

/**
 * Fetch protégé contre le SSRF : URL validée, timeout, redirections
 * suivies manuellement et revalidées à chaque saut.
 */
export async function safeFetch(
  rawUrl: string,
  init: RequestInit = {},
  opts: { timeoutMs?: number; maxRedirects?: number } = {}
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const maxRedirects = opts.maxRedirects ?? 3;

  let url = await assertPublicUrl(rawUrl);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let resp: Response;
    try {
      resp = await fetch(url.toString(), { ...init, redirect: "manual", signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }

    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers.get("location");
      await resp.body?.cancel();
      if (!location || hop === maxRedirects) {
        throw new Error("Trop de redirections");
      }
      url = await assertPublicUrl(new URL(location, url).toString());
      continue;
    }

    return resp;
  }
  throw new Error("Trop de redirections");
}
