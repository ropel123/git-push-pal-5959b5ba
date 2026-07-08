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

// Mois français → numéro (insensible à la casse/aux accents, variantes abrégées incluses).
const FR_MONTHS: Record<string, string> = {
  janvier: "01", janv: "01", jan: "01",
  fevrier: "02", fevr: "02", fev: "02",
  mars: "03", mar: "03",
  avril: "04", avr: "04",
  mai: "05",
  juin: "06",
  juillet: "07", juil: "07", juill: "07",
  aout: "08",
  septembre: "09", sept: "09", sep: "09",
  octobre: "10", oct: "10",
  novembre: "11", nov: "11",
  decembre: "12", dec: "12",
};

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
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
  // DD MoisFR YYYY [HH:mm] ou [HHhMM] — ex: "08 Juin 2026 11:00", "3 décembre 2026 12h30"
  const fm = stripAccents(t.toLowerCase()).match(
    /^(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})(?:\s+(\d{1,2})[:h](\d{2}))?/,
  );
  if (fm) {
    const [, dd, monthName, yyyy, hh = "23", mi = "59"] = fm;
    const mm = FR_MONTHS[monthName];
    if (mm) {
      const iso = `${yyyy}-${mm}-${dd.padStart(2, "0")}T${hh.padStart(2, "0")}:${mi}:00`;
      const d = new Date(iso);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
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
  // Chaîne vide (montant non publié) : Number("") === 0 renverrait un faux 0.
  if (!cleaned || !/\d/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

// Noms de département → code (essayés avant le regex numérique, car les listes
// scrapées fournissent souvent "Seine-Maritime" plutôt que "76").
const DEPT_NAME_TO_CODE: Record<string, string> = {
  "alpes-de-haute-provence": "04", "hautes-alpes": "05", "alpes-maritimes": "06",
  "charente-maritime": "17", "corse-du-sud": "2A", "haute-corse": "2B",
  "cote-d'or": "21", "cotes-d'armor": "22", "eure-et-loir": "28",
  "haute-garonne": "31", "ille-et-vilaine": "35", "indre-et-loire": "37",
  "loir-et-cher": "41", "haute-loire": "43", "loire-atlantique": "44",
  "lot-et-garonne": "47", "maine-et-loire": "49", "haute-marne": "52",
  "meurthe-et-moselle": "54", "pas-de-calais": "62", "puy-de-dome": "63",
  "pyrenees-atlantiques": "64", "hautes-pyrenees": "65", "pyrenees-orientales": "66",
  "bas-rhin": "67", "haut-rhin": "68", "haute-saone": "70", "saone-et-loire": "71",
  "haute-savoie": "74", "seine-maritime": "76", "seine-et-marne": "77",
  "deux-sevres": "79", "tarn-et-garonne": "82", "haute-vienne": "87",
  "territoire de belfort": "90", "hauts-de-seine": "92", "seine-saint-denis": "93",
  "val-de-marne": "94", "val-d'oise": "95",
  "ain": "01", "aisne": "02", "allier": "03", "ardeche": "07", "ardennes": "08",
  "ariege": "09", "aube": "10", "aude": "11", "aveyron": "12", "bouches-du-rhone": "13",
  "calvados": "14", "cantal": "15", "charente": "16", "cher": "18", "correze": "19",
  "creuse": "23", "dordogne": "24", "doubs": "25", "drome": "26", "eure": "27",
  "finistere": "29", "gard": "30", "gers": "32", "gironde": "33", "herault": "34",
  "indre": "36", "isere": "38", "jura": "39", "landes": "40", "loiret": "45", "lot": "46",
  "lozere": "48", "manche": "50", "marne": "51", "mayenne": "53", "meuse": "55",
  "morbihan": "56", "moselle": "57", "nievre": "58", "nord": "59", "oise": "60",
  "orne": "61", "rhone": "69", "sarthe": "72", "savoie": "73", "paris": "75",
  "yvelines": "78", "somme": "80", "tarn": "81", "var": "83", "vaucluse": "84",
  "vendee": "85", "vienne": "86", "vosges": "88", "yonne": "89", "essonne": "91",
  "guadeloupe": "971", "martinique": "972", "guyane": "973",
  "la reunion": "974", "mayotte": "976",
};

// Regex précompilées, frontière de mot : le nom doit être délimité par un
// non-alphanumérique (ou début/fin) pour éviter que "ain" matche "Saint-Nazaire"
// ou "var" matche "Varennes". L'ordre (composés d'abord) est préservé par Object.entries.
const DEPT_NAME_MATCHERS: Array<[RegExp, string]> = Object.entries(DEPT_NAME_TO_CODE).map(
  ([name, code]) => [
    new RegExp(`(^|[^a-z0-9])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`),
    code,
  ],
);

export function detectDeptFromText(s?: string | null): string | null {
  if (!s) return null;
  // 1. Code numérique isolé (haute précision) — gagne sur le nom pour éviter
  //    qu'un mot courant type "Lot 44" soit lu comme le département Lot (46).
  const m = s.match(/\b(2A|2B|97[1-6]|0[1-9]|[1-8]\d|9[0-5])\b/);
  if (m) return m[1];
  // 2. Nom de département explicite (ex: "Seine-Maritime"), typiquement le champ
  //    "location" des listes scrapées. Composés testés avant les simples.
  const normalized = stripAccents(s.toLowerCase());
  for (const [re, code] of DEPT_NAME_MATCHERS) {
    if (re.test(normalized)) return code;
  }
  return null;
}

export function detectContractType(s?: string | null): string | null {
  if (!s) return null;
  const t = s.toLowerCase();
  if (/\btravaux\b/.test(t)) return "travaux";
  if (/\bservice/.test(t)) return "services";
  if (/\bfourniture/.test(t)) return "fournitures";
  return null;
}

// Famille "Atexo" : plateformes qui partagent le même moteur PRADO/SDM
// même si le label régional (maximilien, aura, megalis, ternum) est conservé
// pour le reporting. L'aiguillage côté scrape-list utilise isAtexoFamily()
// pour router vers le moteur PRADO musclé (executeAtexo).
export const ATEXO_FAMILY = new Set<string>([
  "atexo",
  "maximilien",
  "aura",
  "megalis",
  "ternum",
]);

export function isAtexoFamily(platform: string): boolean {
  return ATEXO_FAMILY.has(platform);
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
  "adm76.com",              // Atexo Seine-Maritime (marchespublics.adm76.com)
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

