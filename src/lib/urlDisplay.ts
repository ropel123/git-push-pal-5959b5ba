/**
 * Résolution des liens affichables d'un appel d'offres.
 *
 * Réalité des données (mesurée en base) : les avis proviennent du BOAMP,
 * qui fournit (a) l'URL de l'avis BOAMP lui-même — toujours spécifique —
 * et (b) « l'adresse du profil d'acheteur » — le plus souvent la simple
 * page d'entrée de la plateforme (ex. marches.maximilien.fr/entreprise),
 * stockée en dce_url. Seuls ~23 % des dce_url contiennent un identifiant
 * de consultation (vrai lien profond).
 *
 * Règles produit :
 *  1. Le lien principal est toujours le plus SPÉCIFIQUE disponible
 *     (plateforme profonde > listing enrichi > avis BOAMP/TED).
 *  2. On ne rend JAMAIS zéro lien quand une URL existe en base.
 *  3. Une racine de plateforme générique n'est jamais présentée comme un
 *     lien direct : elle est exposée à part (`platformUrl`) pour un bouton
 *     honnête « Ouvrir la plateforme » + recherche par référence.
 */

export interface TenderUrlFields {
  source_url?: string | null;
  dce_url?: string | null;
  enriched_data?: unknown;
}

/** Chemin trivial : racine ou page d'entrée sans identifiant (/, /entreprise, /accueil…). */
const TRIVIAL_PATH = /^\/?((fr|en)\/?)?((entreprise|entreprises|accueil|portail|home|index\.\w+)\/?)?$/i;

/** La query contient-elle un paramètre ressemblant à un identifiant de consultation ? */
const HAS_CONSULTATION_PARAM = /[?&][^=&]*(id|ref|cons|code)[^=&]*=/i;

/**
 * URL « générique » : page d'entrée/listing de plateforme sans identifiant
 * de consultation exploitable — l'utilisateur atterrirait sur un accueil ou
 * un moteur de recherche vide.
 */
export const isGenericLink = (u?: string | null): boolean => {
  if (!u) return true;

  // affPublication SANS identifiant de consultation = listing MPI générique.
  // Un identifiant valide = refPub/refCons/refConsultation… ou IDS=/IDM=.
  if (/fuseaction=pub\.affPublication/i.test(u) && !/[?&](ref(Pub|Cons|Consult)\w*|IDS|IDM)=/i.test(u)) return true;
  if (/(fuseaction=pub\.affResultats|EntrepriseAdvancedSearch|[?&]AllCons\b|page=recherche|fuseaction=marchesP\.rechM(?![^#]*[?&]IDS=\d))/i.test(u)) {
    return true;
  }

  // Racine/entrée de plateforme (cas majoritaire des dce_url issus du champ
  // « profil d'acheteur » du BOAMP) : chemin trivial et aucun paramètre
  // d'identifiant → page d'accueil, pas une consultation.
  try {
    const parsed = new URL(u);
    if (TRIVIAL_PATH.test(parsed.pathname) && !HAS_CONSULTATION_PARAM.test(parsed.search)) return true;
  } catch {
    return true; // URL non parsable → inutilisable comme lien
  }

  return false;
};

/** URL d'un éditeur d'avis (BOAMP/TED) — spécifique à l'avis, mais pas la plateforme de retrait. */
export const isPublisherUrl = (u?: string | null): boolean => {
  if (!u) return false;
  return /(boamp\.fr|ted\.europa\.eu)/i.test(u);
};

export interface ResolvedTenderUrls {
  /** Lien principal, le plus spécifique disponible (jamais null si une URL exploitable existe). */
  officialUrl: string | null;
  /** Libellé adapté à la nature du lien. */
  officialLabel: string;
  /** true si le lien principal n'est qu'un listing enrichi (pas l'avis lui-même). */
  isFallbackOnly: boolean;
  /** true si le lien principal est l'avis éditeur (BOAMP/TED). */
  isPublisherFallback: boolean;
  /** Lien de retrait du DCE — uniquement un vrai lien profond, sinon null. */
  dceUrl: string | null;
  /** Entrée générique de la plateforme (recherche manuelle par référence), sinon null. */
  platformUrl: string | null;
}

export function resolveTenderUrls(t: TenderUrlFields): ResolvedTenderUrls {
  const enriched = (t.enriched_data ?? {}) as Record<string, unknown>;
  const raw = (enriched.raw ?? {}) as Record<string, unknown>;
  const fallbackListing: string | null =
    (typeof enriched.listing_url === "string" && enriched.listing_url) ||
    (typeof raw._source_url === "string" && raw._source_url) ||
    null;

  const isDeep = (u?: string | null): u is string => !!u && !isGenericLink(u) && !isPublisherUrl(u);

  // 1. Lien profond vers la consultation sur la plateforme.
  const deepUrl = (isDeep(t.source_url) ? t.source_url : null) || (isDeep(t.dce_url) ? t.dce_url : null);
  const dceUrl = isDeep(t.dce_url) ? t.dce_url : null;

  // 2. Listing enrichi (page de la plateforme listant la consultation).
  const listingUrl = isDeep(fallbackListing) ? fallbackListing : null;

  // 3. Avis éditeur (BOAMP/TED) — toujours spécifique à l'avis.
  const publisherUrl =
    (isPublisherUrl(t.source_url) ? t.source_url! : null) ||
    (isPublisherUrl(t.dce_url) ? t.dce_url! : null) ||
    (fallbackListing && isPublisherUrl(fallbackListing) ? fallbackListing : null);

  // Entrée générique de plateforme : utile pour une recherche manuelle par référence.
  const platformUrl =
    [t.dce_url, t.source_url, fallbackListing].find((u) => u && !isPublisherUrl(u) && isGenericLink(u)) ?? null;

  const officialUrl = deepUrl || listingUrl || publisherUrl;
  const isFallbackOnly = !deepUrl && !!listingUrl;
  const isPublisherFallback = !deepUrl && !listingUrl && !!publisherUrl;

  const officialLabel = deepUrl
    ? "Voir l'avis original"
    : isFallbackOnly
      ? "Voir sur la plateforme acheteur"
      : isPublisherFallback
        ? /ted\.europa\.eu/i.test(publisherUrl!)
          ? "Voir l'avis original (TED)"
          : "Voir l'avis original (BOAMP)"
        : "Voir l'avis original";

  return { officialUrl, officialLabel, isFallbackOnly, isPublisherFallback, dceUrl, platformUrl };
}
