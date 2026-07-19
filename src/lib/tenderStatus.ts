/**
 * Libellés et couleurs des statuts d'appel d'offres (tenders).
 * Source unique de vérité — évite la dérive entre Tenders / TenderDetail / BuyerDetail
 * qui dupliquaient ces constantes.
 */

export const statusLabel: Record<string, string> = {
  open: "Ouvert",
  closed: "Clôturé",
  awarded: "Attribué",
  cancelled: "Annulé",
};

export const statusColor: Record<string, string> = {
  open: "bg-green-500/20 text-green-400 border-green-500/30",
  closed: "bg-red-500/20 text-red-400 border-red-500/30",
  awarded: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  cancelled: "bg-muted text-muted-foreground",
};

/**
 * Variante fonction : renvoie une couleur par défaut (muted) pour tout statut
 * inconnu ou nul. Utilisée par la liste Tenders (mêmes valeurs que le switch
 * d'origine).
 */
export const getStatusColor = (status: string | null): string =>
  statusColor[status ?? ""] ?? "bg-muted text-muted-foreground";
