import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, Building2, Users, Award, MapPin, Calendar, Euro, FileText } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { decodeHtml } from "@/lib/utils";

type Criterion = { name?: string; weight?: number; type?: string };
type Lot = { lot_id?: string; name?: string; winner_name?: string; winner_siren?: string; amount?: number; rank?: number };

export type AwardDetail = {
  id: string;
  source?: string | null;
  reference?: string | null;
  title?: string | null;
  winner_name?: string | null;
  winner_siren?: string | null;
  winner_address?: string | null;
  winner_legal_form?: string | null;
  winner_country?: string | null;
  awarded_amount?: number | null;
  contract_duration?: string | null;
  num_candidates?: number | null;
  offers_received?: number | null;
  offers_admitted?: number | null;
  offers_rejected?: number | null;
  subcontracting_share?: number | null;
  award_date?: string | null;
  notification_date?: string | null;
  award_criteria?: Criterion[] | null;
  lots_awarded?: Lot[] | null;
  cpv_codes?: string[] | null;
  place_of_performance?: string | null;
  notice_url?: string | null;
  source_url?: string | null;
};

const fmtEur = (n?: number | null) =>
  typeof n === "number" ? new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €" : null;

const fmtDate = (d?: string | null) => {
  if (!d) return null;
  try {
    return format(new Date(d), "dd MMM yyyy", { locale: fr });
  } catch {
    return d;
  }
};

export function AwardDetailDialog({
  award,
  open,
  onOpenChange,
}: {
  award: AwardDetail | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  if (!award) return null;

  const lots = Array.isArray(award.lots_awarded) ? award.lots_awarded.filter((l) => l && (l.winner_name || l.amount)) : [];
  const criteria = Array.isArray(award.award_criteria) ? award.award_criteria : [];
  const totalWeight = criteria.reduce((s, c) => s + (Number(c.weight) || 0), 0) || 100;

  const sirenUrl = award.winner_siren
    ? `https://annuaire-entreprises.data.gouv.fr/entreprise/${award.winner_siren.replace(/\s/g, "")}`
    : null;
  const externalUrl = award.notice_url || award.source_url;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Award className="h-5 w-5 text-primary" />
            <DialogTitle className="text-lg">Avis d'attribution</DialogTitle>
            {award.source && (
              <Badge variant="secondary" className="text-[10px] uppercase">
                {award.source}
              </Badge>
            )}
          </div>
          {(award.reference || award.notification_date || award.award_date) && (
            <p className="text-xs text-muted-foreground mt-1">
              {award.reference && <span>{award.reference}</span>}
              {award.reference && (award.notification_date || award.award_date) && <span> • </span>}
              {(award.notification_date || award.award_date) && (
                <span>Notifié le {fmtDate(award.notification_date || award.award_date)}</span>
              )}
            </p>
          )}
        </DialogHeader>

        {/* Titulaire */}
        {(award.winner_name || award.winner_siren) && (
          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Titulaire
            </h3>
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold text-foreground">{decodeHtml(award.winner_name) || "—"}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                    {award.winner_legal_form && <span>{award.winner_legal_form}</span>}
                    {award.winner_siren && (
                      sirenUrl ? (
                        <a
                          href={sirenUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-0.5"
                        >
                          SIREN {award.winner_siren}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span>SIREN {award.winner_siren}</span>
                      )
                    )}
                    {award.winner_country && <span>{award.winner_country}</span>}
                  </div>
                  {award.winner_address && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                      <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                      {award.winner_address}
                    </p>
                  )}
                </div>
                {award.awarded_amount != null && (
                  <div className="text-right">
                    <p className="text-xl font-semibold text-foreground">{fmtEur(award.awarded_amount)}</p>
                    {award.contract_duration && (
                      <p className="text-xs text-muted-foreground">Durée : {award.contract_duration}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Concurrence */}
        {(award.offers_received != null ||
          award.num_candidates != null ||
          award.offers_admitted != null ||
          award.offers_rejected != null ||
          award.subcontracting_share != null) && (
          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Concurrence
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(award.offers_received ?? award.num_candidates) != null && (
                <Stat label="Offres reçues" value={String(award.offers_received ?? award.num_candidates)} />
              )}
              {award.offers_admitted != null && <Stat label="Admises" value={String(award.offers_admitted)} />}
              {award.offers_rejected != null && <Stat label="Rejetées" value={String(award.offers_rejected)} />}
              {award.subcontracting_share != null && (
                <Stat label="Sous-traitance" value={`${Math.round(award.subcontracting_share)} %`} />
              )}
            </div>
          </section>
        )}

        {/* Critères */}
        {criteria.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Critères de notation
            </h3>
            <div className="space-y-2">
              {criteria.map((c, i) => {
                const w = Number(c.weight) || 0;
                const pct = totalWeight > 0 ? (w / totalWeight) * 100 : 0;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground">{c.name || c.type || `Critère ${i + 1}`}</span>
                      <span className="text-muted-foreground tabular-nums">{w}%</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Lots */}
        {lots.length > 1 && (
          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Lots attribués</h3>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Lot</th>
                    <th className="text-left px-3 py-2">Titulaire</th>
                    <th className="text-right px-3 py-2">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {lots.map((l, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2 text-muted-foreground">{l.lot_id || l.name || `Lot ${i + 1}`}</td>
                      <td className="px-3 py-2">{decodeHtml(l.winner_name) || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtEur(l.amount) || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Métadonnées marché */}
        {(award.place_of_performance || (award.cpv_codes && award.cpv_codes.length > 0)) && (
          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Marché</h3>
            <div className="space-y-1.5 text-sm">
              {award.place_of_performance && (
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {award.place_of_performance}
                </p>
              )}
              {award.cpv_codes && award.cpv_codes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {award.cpv_codes.map((c) => (
                    <Badge key={c} variant="outline" className="text-[10px] font-mono">
                      {c}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {externalUrl && (
          <>
            <Separator />
            <div className="flex justify-end">
              <Button asChild variant="outline" size="sm">
                <a href={externalUrl} target="_blank" rel="noopener noreferrer">
                  Voir l'avis officiel
                  <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                </a>
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-base font-semibold text-foreground tabular-nums">{value}</p>
    </div>
  );
}
