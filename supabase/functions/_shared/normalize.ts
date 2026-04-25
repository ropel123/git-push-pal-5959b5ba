// Normalisation FR (dates, montants, régions, contract types)

const DEPT_TO_REGION: Record<string, string> = {
  "01": "Auvergne-Rhône-Alpes", "03": "Auvergne-Rhône-Alpes", "07": "Auvergne-Rhône-Alpes",
  "15": "Auvergne-Rhône-Alpes", "26": "Auvergne-Rhône-Alpes", "38": "Auvergne-Rhône-Alpes",
  "42": "Auvergne-Rhône-Alpes", "43": "Auvergne-Rhône-Alpes", "63": "Auvergne-Rhône-Alpes",
  "69": "Auvergne-Rhône-Alpes", "73": "Auvergne-Rhône-Alpes", "74": "Auvergne-Rhône-Alpes",
  "21": "Bourgogne-Franche-Comté", "25": "Bourgogne-Franche-Comté", "39": "Bourgogne-Franche-Comté",
  "58": "Bourgogne-Franche-Comté", "70": "Bourgogne-Franche-Comté", "71": "Bourgogne-Franche-Comté",
  "89": "Bourgogne-Franche-Comté", "90": "Bourgogne-Franche-Comté",
  "22": "Bretagne", "29": "Bretagne", "35": "Bretagne", "56": "Bretagne",
  "18": "Centre-Val de Loire", "28": "Centre-Val de Loire", "36": "Centre-Val de Loire",
  "37": "Centre-Val de Loire", "41": "Centre-Val de Loire", "45": "Centre-Val de Loire",
  "2A": "Corse", "2B": "Corse",
  "08": "Grand Est", "10": "Grand Est", "51": "Grand Est", "52": "Grand Est", "54": "Grand Est",
  "55": "Grand Est", "57": "Grand Est", "67": "Grand Est", "68": "Grand Est", "88": "Grand Est",
  "02": "Hauts-de-France", "59": "Hauts-de-France", "60": "Hauts-de-France",
  "62": "Hauts-de-France", "80": "Hauts-de-France",
  "75": "Île-de-France", "77": "Île-de-France", "78": "Île-de-France", "91": "Île-de-France",
  "92": "Île-de-France", "93": "Île-de-France", "94": "Île-de-France", "95": "Île-de-France",
  "14": "Normandie", "27": "Normandie", "50": "Normandie", "61": "Normandie", "76": "Normandie",
  "16": "Nouvelle-Aquitaine", "17": "Nouvelle-Aquitaine", "19": "Nouvelle-Aquitaine",
  "23": "Nouvelle-Aquitaine", "24": "Nouvelle-Aquitaine", "33": "Nouvelle-Aquitaine",
  "40": "Nouvelle-Aquitaine", "47": "Nouvelle-Aquitaine", "64": "Nouvelle-Aquitaine",
  "79": "Nouvelle-Aquitaine", "86": "Nouvelle-Aquitaine", "87": "Nouvelle-Aquitaine",
  "09": "Occitanie", "11": "Occitanie", "12": "Occitanie", "30": "Occitanie", "31": "Occitanie",
  "32": "Occitanie", "34": "Occitanie", "46": "Occitanie", "48": "Occitanie", "65": "Occitanie",
  "66": "Occitanie", "81": "Occitanie", "82": "Occitanie",
  "44": "Pays de la Loire", "49": "Pays de la Loire", "53": "Pays de la Loire",
  "72": "Pays de la Loire", "85": "Pays de la Loire",
  "04": "Provence-Alpes-Côte d'Azur", "05": "Provence-Alpes-Côte d'Azur",
  "06": "Provence-Alpes-Côte d'Azur", "13": "Provence-Alpes-Côte d'Azur",
  "83": "Provence-Alpes-Côte d'Azur", "84": "Provence-Alpes-Côte d'Azur",
  "971": "Guadeloupe", "972": "Martinique", "973": "Guyane",
  "974": "La Réunion", "976": "Mayotte",
};

export function deptToRegion(dept?: string | null): string | null {
  if (!dept) return null;
  return DEPT_TO_REGION[dept.trim()] ?? null;
}

export function parseFrenchDate(s?: string | null): string | null {
  if (!s) return null;
  const t = String(s).trim();
  // ISO already
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    const d = new Date(t);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  // DD/MM/YYYY [HH:mm]
  const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) {
    const [, dd, mm, yyyyRaw, hh = "23", mi = "59"] = m;
    const yyyy = yyyyRaw.length === 2 ? `20${yyyyRaw}` : yyyyRaw;
    const iso = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T${hh.padStart(2, "0")}:${mi}:00`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

export function parseAmount(s?: string | number | null): number | null {
  if (s == null) return null;
  if (typeof s === "number") return Number.isFinite(s) ? s : null;
  const cleaned = String(s)
    .replace(/[€$£\s\u00A0]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function detectDeptFromText(s?: string | null): string | null {
  if (!s) return null;
  const m = s.match(/\b(2A|2B|97[1-6]|0[1-9]|[1-8]\d|9[0-5])\b/);
  return m ? m[1] : null;
}

export function detectContractType(s?: string | null): string | null {
  if (!s) return null;
  const t = s.toLowerCase();
  if (/\btravaux\b/.test(t)) return "travaux";
  if (/\bservice/.test(t)) return "services";
  if (/\bfourniture/.test(t)) return "fournitures";
  return null;
}

// Hostnames qui tournent sur Atexo (LocalTrust / SDM) sans avoir
// "atexo" littéralement dans le hostname.
const ATEXO_HOST_SUFFIXES = [
  "ampmetropole.fr",
  "nantesmetropole.fr",
  "paysdelaloire.fr",
  "grand-nancy.org",
  "grandlyon.com",
  "aquitaine.fr",
  "lorraine.eu",
  "demat-ampa.fr",
  "marches-publics-hopitaux.fr",
  "alsacemarchespublics.eu",
  "solaere.recia.fr",       // RECIA Centre-Val de Loire
  "webmarche.recia.fr",
];

function endsWithHost(host: string, suffix: string): boolean {
  return host === suffix || host.endsWith("." + suffix);
}

/**
 * Classifie une URL vers une plateforme connue.
 * Règles ordonnées par spécificité : host exact > suffixe host > path > pattern URL.
 * Doit rester strictement aligné avec src/lib/detectPlatform.ts.
 */
export function detectPlatformFromUrl(url: string): string {
  return detectPlatformFromUrlInternal(url);
}

function detectPlatformFromUrlInternal(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = u.pathname.toLowerCase();
    const search = u.search.toLowerCase();
    const fullPath = path + search;

    // 1. Hostname exacts / suffixes régionaux dédiés
    if (host === "marchespublics.auvergnerhonealpes.eu") return "aura";
    if (endsWithHost(host, "maximilien.fr")) return "maximilien";
    if (endsWithHost(host, "megalis.bretagne.bzh")) return "megalis";
    if (endsWithHost(host, "ternum-bfc.fr")) return "ternum";

    // 2. Atexo (SDM/LocalTrust régionaux + RECIA + suffixes)
    for (const sfx of ATEXO_HOST_SUFFIXES) {
      if (endsWithHost(host, sfx)) return "atexo";
    }
    if (host.includes("atexo")) return "atexo";

    // 3. MPI
    if (endsWithHost(host, "marches-publics.info")) return "mpi";
    if (endsWithHost(host, "marchespublics.grandest.fr")) return "mpi";

    // 4. PLACE
    if (endsWithHost(host, "projets-achats.marches-publics.gouv.fr")) return "place";
    if (host === "marches-publics.gouv.fr" || host === "www.marches-publics.gouv.fr") return "place";

    // 5. Autres éditeurs (hostname)
    if (endsWithHost(host, "achatpublic.com")) return "achatpublic";
    if (endsWithHost(host, "e-marchespublics.com")) return "e-marchespublics";
    if (endsWithHost(host, "marches-securises.fr")) return "marches-securises";
    if (endsWithHost(host, "klekoon.com")) return "klekoon";
    if (endsWithHost(host, "xmarches.fr")) return "xmarches";
    if (endsWithHost(host, "omnikles.com")) return "omnikles";
    if (endsWithHost(host, "synapse-entreprises.com")) return "synapse";
    if (endsWithHost(host, "centraledesmarches.com")) return "centrale-marches";
    if (endsWithHost(host, "francemarches.com")) return "francemarches";
    if (endsWithHost(host, "aji-france.com")) return "aji";
    if (endsWithHost(host, "eu-supply.com")) return "eu-supply";

    // 6. SafeTender STRICT (uniquement si "safetender" littéralement dans le hostname)
    if (host.includes("safetender")) return "safetender";

    // 7. Patterns d'URL universels (signature SDM/LocalTrust quel que soit le hostname)
    // ?page=Entreprise.EntrepriseAdvancedSearch est LE marqueur canonique d'Atexo SDM
    if (search.includes("page=entreprise.entrepriseadvancedsearch")) return "atexo";
    if (path.includes("/sdm/ent2/gen/")) return "atexo";
    if (path.includes("/sdm/")) return "atexo";
    if (path.includes("/app_atexo/")) return "atexo";

    // ColdFusion → MPI
    if (path.endsWith(".cfm") && search.includes("fuseaction=")) return "mpi";

    // Omnikles patterns
    if (path.includes("/okmarche/")) return "omnikles";
    if (path.includes("/xmarches/okmarche/")) return "omnikles";

    // Domino (Lotus Notes)
    if (search.includes("openform") || search.includes("readform")) return "domino";
    if (path.includes(".nsf/")) return "domino";

    console.warn(`[detectPlatformFromUrl] Plateforme inconnue pour host=${host} path=${fullPath} → custom`);
    return "custom";
  } catch {
    return "custom";
  }
}

// ============================================================
// Pipeline déterministe en cascade :
// 1. Cache platform_fingerprints (24h)
// 2. Hostname étendu (gratuit, 0ms)
// 3. Signatures DOM via fetch HTML local (déterministe, gratuit)
// 4. IA en dernier recours (Claude Haiku via Anthropic web_fetch)
// ============================================================
import { fetchHtmlForClassification } from "./fingerprint.ts";
import { detectPlatformFromHtml } from "./detectPlatformFromHtml.ts";
import { classifyWithProvider, modelLabel, type AIProvider, DEFAULT_PROVIDER } from "./classifyDispatcher.ts";

const FINGERPRINT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

type SupabaseLike = {
  from: (table: string) => any;
};

export type ResolvedPlatform = {
  platform: string;
  source: "cache" | "hostname" | "ai" | "fallback";
  confidence: number;
  evidence: string[];
  pagination_hint?: string;
};

/**
 * Pipeline AI-first :
 * 1. Cache platform_fingerprints (24h)
 * 2. Hostname fast-path pour les hosts évidents (instantané, sans appel réseau)
 * 3. Téléchargement HTML + appel Claude (OpenRouter)
 * 4. Si confidence ≥ 0.6 → cache + return ; sinon → "custom" + log warning
 */
export async function resolvePlatform(
  url: string,
  supabase: SupabaseLike,
  opts: { force?: boolean; provider?: AIProvider } = {}
): Promise<ResolvedPlatform> {
  const provider: AIProvider = opts.provider ?? DEFAULT_PROVIDER;
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return { platform: "custom", source: "fallback", confidence: 0, evidence: ["bad-url"] };
  }

  // 1. Cache
  if (!opts.force) {
    const { data: cached } = await supabase
      .from("platform_fingerprints")
      .select("platform, confidence, evidence, detected_at")
      .eq("host", host)
      .maybeSingle();
    if (cached) {
      const age = Date.now() - new Date(cached.detected_at).getTime();
      if (age < FINGERPRINT_TTL_MS) {
        const evidence = Array.isArray(cached.evidence) ? cached.evidence : [];
        const paginationFromCache = evidence
          .find((e: string) => typeof e === "string" && e.startsWith("pagination:"))
          ?.split(":")[1];
        return {
          platform: cached.platform,
          source: "cache",
          confidence: Number(cached.confidence) || 0,
          evidence,
          pagination_hint: paginationFromCache,
        };
      }
    }
  }

  // 2. Hostname fast-path (cas évidents, zéro latence)
  const fromHost = detectPlatformFromUrlInternal(url);
  if (fromHost !== "custom" && !opts.force) {
    return {
      platform: fromHost,
      source: "hostname",
      confidence: 0.95,
      evidence: [`hostname:${host}`],
    };
  }

  // 3. Couche DOM déterministe : on fetch le HTML et on cherche des signatures sans IA
  const fetched = await fetchHtmlForClassification(url);
  let html = fetched.html;
  let headers = fetched.headers;

  if (html) {
    const domMatch = detectPlatformFromHtml(html);
    if (domMatch) {
      const evidence = [
        `dom-signature`,
        `evidence:${domMatch.evidence}`,
        `pagination:${domMatch.pagination_hint}`,
      ];
      // Cache + return
      try {
        await supabase.from("platform_fingerprints").upsert(
          {
            host,
            platform: domMatch.platform,
            confidence: domMatch.confidence,
            evidence,
            detected_at: new Date().toISOString(),
          },
          { onConflict: "host" }
        );
      } catch (err) {
        console.warn(`[resolvePlatform] cache write failed for ${host}:`, err);
      }
      return {
        platform: domMatch.platform,
        source: "ai",            // on reste compatible avec l'enum existant
        confidence: domMatch.confidence,
        evidence,
        pagination_hint: domMatch.pagination_hint,
      };
    }
  } else if (!fetched.ok && provider === "openrouter") {
    // OpenRouter a besoin du HTML local ; sans HTML on ne peut rien faire
    console.warn(`[resolvePlatform] HTML fetch failed for ${host}: ${fetched.error ?? fetched.status}`);
    return { platform: "custom", source: "fallback", confidence: 0, evidence: [`fetch-failed:${fetched.error ?? fetched.status}`] };
  }

  // 4. Classification IA (dernier recours)
  // - provider "anthropic" : web_fetch côté Anthropic, peut classifier même sans HTML local
  // - provider "openrouter" : utilise le HTML qu'on vient de fetch
  const ai = await classifyWithProvider({ url, htmlSnippet: html, responseHeaders: headers, provider });

  const finalPlatform = ai.platform;
  const finalConfidence = ai.confidence;
  const evidence: string[] = [
    `ai:${modelLabel(provider)}`,
    `confidence:${ai.confidence.toFixed(2)}`,
    `pagination:${ai.pagination_hint}`,
  ];
  if (ai.reasoning) evidence.push(`reasoning:${ai.reasoning}`);

  // Pas de seuil : on fait confiance au verdict de l'agent.
  // Si l'agent renvoie "custom", c'est qu'il a vraiment rien trouvé.
  if (finalPlatform === "custom") {
    console.warn(`[resolvePlatform] custom for host=${host} ai=${ai.platform}@${ai.confidence} reasoning="${ai.reasoning}"`);
  }

  // Cache (uniquement si on a une vraie plateforme)
  if (finalPlatform !== "custom") {
    try {
      await supabase.from("platform_fingerprints").upsert(
        {
          host,
          platform: finalPlatform,
          confidence: finalConfidence,
          evidence,
          detected_at: new Date().toISOString(),
        },
        { onConflict: "host" }
      );
    } catch (err) {
      console.warn(`[resolvePlatform] cache write failed for ${host}:`, err);
    }
  }

  return {
    platform: finalPlatform,
    source: finalPlatform === "custom" ? "fallback" : "ai",
    confidence: finalConfidence,
    evidence,
    pagination_hint: ai.pagination_hint,
  };
}
