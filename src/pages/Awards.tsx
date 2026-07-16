import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Award, Euro, Users, ChevronRight, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useAwardsInfinite, type AwardWithTender } from "@/hooks/queries/useAwards";
import { useDebounce } from "@/hooks/useDebounce";
import { AwardDetailDialog, type AwardDetail } from "@/components/awards/AwardDetailDialog";
import { decodeHtml } from "@/lib/utils";

const Awards = () => {
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<"all" | "BOAMP" | "TED" | "legacy">("all");
  const [sinceDays, setSinceDays] = useState<string>("all");
  const [selected, setSelected] = useState<AwardDetail | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useAwardsInfinite({
    search: debouncedSearch,
    source,
    sinceDays: sinceDays === "all" ? null : Number(sinceDays),
  });

  const rows: AwardWithTender[] = data?.pages.flatMap((p) => p.rows) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  const toDetail = (a: AwardWithTender): AwardDetail => ({
    id: a.id,
    source: a.source,
    reference: a.reference,
    title: decodeHtml(a.tenders?.title) || null,
    winner_name: a.winner_name,
    winner_siren: a.winner_siren,
    winner_address: a.winner_address,
    winner_legal_form: a.winner_legal_form,
    winner_country: a.winner_country,
    awarded_amount: a.awarded_amount,
    contract_duration: a.contract_duration,
    num_candidates: a.num_candidates,
    offers_received: a.offers_received,
    offers_admitted: a.offers_admitted,
    offers_rejected: a.offers_rejected,
    subcontracting_share: a.subcontracting_share,
    award_date: a.award_date,
    notification_date: a.notification_date,
    award_criteria: (a.award_criteria as AwardDetail["award_criteria"]) ?? null,
    lots_awarded: (a.lots_awarded as AwardDetail["lots_awarded"]) ?? null,
    cpv_codes: a.cpv_codes,
    place_of_performance: a.place_of_performance,
    notice_url: a.notice_url,
    source_url: a.source_url,
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Avis d'attribution</h1>
        <p className="text-muted-foreground">
          {isLoading ? "…" : `${total.toLocaleString("fr-FR")} résultat(s)`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par titulaire, titre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes sources</SelectItem>
            <SelectItem value="BOAMP">BOAMP</SelectItem>
            <SelectItem value="TED">TED</SelectItem>
            <SelectItem value="legacy">Données legacy</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sinceDays} onValueChange={setSinceDays}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes périodes</SelectItem>
            <SelectItem value="90">3 derniers mois</SelectItem>
            <SelectItem value="180">6 derniers mois</SelectItem>
            <SelectItem value="365">12 derniers mois</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
      ) : rows.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Award className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Aucun avis d'attribution</p>
            <p className="text-sm mt-1">Les avis d'attribution apparaîtront ici une fois importés.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {rows.map((award) => {
              const enriched = !!(award.award_criteria || award.winner_address || award.offers_received);
              return (
                <Card
                  key={award.id}
                  className="bg-card border-border cursor-pointer hover:bg-secondary/40 transition"
                  onClick={() => setSelected(toDetail(award))}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold text-foreground flex-1">{decodeHtml(award.tenders?.title) || "—"}</h3>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {award.source && (
                          <Badge variant="secondary" className="text-[10px] uppercase">{award.source}</Badge>
                        )}
                        {enriched && (
                          <Badge variant="outline" className="text-[10px] gap-0.5">
                            <Sparkles className="h-2.5 w-2.5" /> enrichi
                          </Badge>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {award.winner_name && (
                        <span className="flex items-center gap-1">
                          <Award className="h-3 w-3 text-green-500" /> {award.winner_name}
                        </span>
                      )}
                      {award.awarded_amount != null && (
                        <span className="flex items-center gap-1">
                          <Euro className="h-3 w-3" />
                          {new Intl.NumberFormat("fr-FR").format(award.awarded_amount)} €
                        </span>
                      )}
                      {(award.offers_received ?? award.num_candidates) != null && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" /> {award.offers_received ?? award.num_candidates} offres
                        </span>
                      )}
                      {award.award_date && (
                        <span>{format(new Date(award.award_date), "dd MMM yyyy", { locale: fr })}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? "Chargement..." : "Charger plus"}
              </Button>
            </div>
          )}
        </>
      )}

      <AwardDetailDialog award={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
};

export default Awards;
