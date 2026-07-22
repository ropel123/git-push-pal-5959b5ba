/**
 * Résolution des liens affichables d'un appel d'offres.
 *
 * Logique extraite de TenderDetail (elle y était inline et non testée) et
 * partagée avec la liste /tenders. Règle produit : on privilégie les URLs
 * « plateforme acheteur » (consultation directe), mais on ne rend JAMAIS
 * une fiche sans aucun lien quand une URL existe en base — au pire on
 * affiche le lien éditeur (BOAMP/TED) avec un libellé dégradé.
 * Contexte : 100 % du stock actuel a un source_url boamp.fr / ted.europa.eu.
 */

export interface TenderUrlFields {
  source_url?: string | null;
  dce_url?: string | null;
  enriched_data?: unknown;
}

/**
 * URL « générique » : page de listing/résultats sans identifiant de
 * consultation exploitable (l'utilisateur atterrirait sur un moteur de
 * recherche vide).
 */
export const isGenericLink = (u?: string | null): boolean => {
  if (!u) return true;
  // affPublication SANS identifiant de consultation = listing MPI générique.
  // Un identifiant valide = refPub/refCons/refConsultation… ou IDS=/IDM=.
  if (/fuseaction=pub\.affPublication/i.test(u) && !/[?&](ref(Pub|Cons|Consult)\w*|IDS|IDM)=/i.test(u)) return true;
  return /(fuseaction=pub\.affResultats|EntrepriseAdvancedSearch|[?&]AllCons\b|page=recherche|fuseaction=marchesP\.rechM(?![^#]*[?&]IDS=\d))/i.test(u);
};

/** URL d'un éditeur d'avis (BOAMP/TED) — pas la plateforme de consultation. */
export const isPublisherUrl = (u?: string | null): boolean => {
  if (!u) return false;
  return /(boamp\.fr|ted\.europa\.eu)/i.test(u);
};

export interface ResolvedTenderUrls {
  /** Lien principal à afficher (jamais null si une URL exploitable existe). */
  officialUrl: string | null;
  /** Libellé adapté à la qualité du lien. */
  officialLabel: string;
  /** true si on n'a qu'un lien de listing (fallback enriched_data). */
  isFallbackOnly: boolean;
  /** true si le lien affiché est un avis éditeur (BOAMP/TED). */
  isPublisherFallback: boolean;
  /** Lien de retrait du DCE (bouton dédié), ou null. */
  dceUrl: string | null;
}

export function resolveTenderUrls(t: TenderUrlFields): ResolvedTenderUrls {
  const enriched = (t.enriched_data ?? {}) as Record<string, unknown>;
  const raw = (enriched.raw ?? {}) as Record<string, unknown>;
  const fallbackListing: string | null =
    (typeof enriched.listing_url === "string" && enriched.listing_url) ||
    (typeof raw._source_url === "string" && raw._source_url) ||
    null;

  const dceUrl = t.dce_url && !isGenericLink(t.dce_url) && !isPublisherUrl(t.dce_url) ? t.dce_url : null;

  const primaryUrl =
    (!isGenericLink(t.source_url) && !isPublisherUrl(t.source_url) ? t.source_url! : null) ||
    (!isGenericLink(t.dce_url) && !isPublisherUrl(t.dce_url) ? t.dce_url! : null);

  const listingUrl = fallbackListing && !isPublisherUrl(fallbackListing) ? fallbackListing : null;

  // Dernier recours : ne jamais rendre zéro lien si une URL existe en base.
  // L'avis éditeur (BOAMP/TED) reste consultable même s'il ne permet pas de
  // retirer le DCE directement.
  const publisherUrl =
    (isPublisherUrl(t.source_url) ? t.source_url! : null) ||
    (isPublisherUrl(t.dce_url) ? t.dce_url! : null) ||
    (fallbackListing && isPublisherUrl(fallbackListing) ? fallbackListing : null);

  const officialUrl = primaryUrl || listingUrl || publisherUrl;
  const isFallbackOnly = !primaryUrl && !!listingUrl;
  const isPublisherFallback = !primaryUrl && !listingUrl && !!publisherUrl;

  const officialLabel = primaryUrl
    ? "Voir l'avis original"
    : isPublisherFallback
      ? "Voir l'avis publié (BOAMP / TED)"
      : "Voir sur la plateforme acheteur";

  return { officialUrl, officialLabel, isFallbackOnly, isPublisherFallback, dceUrl };
}
