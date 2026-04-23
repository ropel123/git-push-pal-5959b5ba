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
];

function endsWithHost(host: string, suffix: string): boolean {
  return host === suffix || host.endsWith("." + suffix);
}

export function detectPlatform(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = u.pathname.toLowerCase();

    // 1. Hostname exacts / suffixes régionaux dédiés
    if (host === "marchespublics.auvergnerhonealpes.eu") return "aura";
    if (endsWithHost(host, "maximilien.fr")) return "maximilien";
    if (endsWithHost(host, "megalis.bretagne.bzh")) return "megalis";
    if (endsWithHost(host, "ternum-bfc.fr")) return "ternum";

    // 2. Atexo (SDM/LocalTrust régionaux)
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

    // 5. Autres éditeurs
    if (endsWithHost(host, "achatpublic.com")) return "achatpublic";
    if (endsWithHost(host, "e-marchespublics.com")) return "e-marchespublics";
    if (endsWithHost(host, "marches-securises.fr")) return "marches-securises";
    if (endsWithHost(host, "klekoon.com")) return "klekoon";
    if (endsWithHost(host, "xmarches.fr")) return "xmarches";

    // 6. SafeTender STRICT (uniquement si "safetender" littéralement dans le hostname)
    if (host.includes("safetender")) return "safetender";

    // 7. Fallback SDM (LocalTrust) → atexo
    if (path.includes("/sdm/ent2/gen/")) return "atexo";
    if (path.includes("/sdm/")) return "atexo";

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
  // Plateformes additionnelles reconnues par la classification IA (Claude)
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
