// Détection robuste de la plateforme à partir d'une URL.
// Doit rester strictement alignée avec supabase/functions/_shared/normalize.ts → detectPlatformFromUrl.

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
  "solaere.recia.fr",
  "webmarche.recia.fr",
];

function endsWithHost(host: string, suffix: string): boolean {
  return host === suffix || host.endsWith("." + suffix);
}

export function detectPlatform(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = u.pathname.toLowerCase();
    const search = u.search.toLowerCase();

    if (host === "marchespublics.auvergnerhonealpes.eu") return "aura";
    if (endsWithHost(host, "maximilien.fr")) return "maximilien";
    if (endsWithHost(host, "megalis.bretagne.bzh")) return "megalis";
    if (endsWithHost(host, "ternum-bfc.fr")) return "ternum";

    for (const sfx of ATEXO_HOST_SUFFIXES) {
      if (endsWithHost(host, sfx)) return "atexo";
    }
    if (host.includes("atexo")) return "atexo";

    if (endsWithHost(host, "marches-publics.info")) return "mpi";
    if (endsWithHost(host, "marchespublics.grandest.fr")) return "mpi";

    if (endsWithHost(host, "projets-achats.marches-publics.gouv.fr")) return "place";
    if (host === "marches-publics.gouv.fr" || host === "www.marches-publics.gouv.fr") return "place";

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

    if (host.includes("safetender")) return "safetender";

    if (search.includes("page=entreprise.entrepriseadvancedsearch")) return "atexo";
    if (path.includes("/sdm/ent2/gen/")) return "atexo";
    if (path.includes("/sdm/")) return "atexo";
    if (path.includes("/app_atexo/")) return "atexo";
    if (path.endsWith(".cfm") && search.includes("fuseaction=")) return "mpi";
    if (path.includes("/okmarche/")) return "omnikles";
    if (path.includes("/xmarches/okmarche/")) return "omnikles";
    if (search.includes("openform") || search.includes("readform")) return "domino";
    if (path.includes(".nsf/")) return "domino";

    return "custom";
  } catch {
    return "custom";
  }
}

export const PLATFORMS = [
  "mpi",
  "place",
  "achatpublic",
  "e-marchespublics",
  "marches-securises",
  "maximilien",
  "megalis",
  "ternum",
  "aura",
  "atexo",
  "safetender",
  "xmarches",
  "klekoon",
  "omnikles",
  "aws",
  "eu-supply",
  "synapse",
  "centrale-marches",
  "francemarches",
  "aji",
  "domino",
  "custom",
];
