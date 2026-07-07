// Statut d'affichage d'un tender : la colonne `status` en base peut rester "open"
// jusqu'à 24h après l'échéance (marge du cron close-expired-tenders). L'UI ne doit
// jamais présenter comme "Ouvert" un AO dont la deadline est passée.
export function effectiveTenderStatus(
  status: string | null | undefined,
  deadline: string | null | undefined,
): string | null {
  if (status === "open" && deadline && new Date(deadline).getTime() < Date.now()) {
    return "expired";
  }
  return status ?? null;
}

export const tenderStatusLabel: Record<string, string> = {
  open: "Ouvert",
  expired: "Expiré",
  closed: "Clôturé",
  awarded: "Attribué",
  cancelled: "Annulé",
};

export const tenderStatusColor: Record<string, string> = {
  open: "bg-green-500/20 text-green-400 border-green-500/30",
  expired: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  closed: "bg-red-500/20 text-red-400 border-red-500/30",
  awarded: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  cancelled: "bg-muted text-muted-foreground",
};
