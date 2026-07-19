import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, Euro, Calendar, MapPin } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useBuyerData } from "@/hooks/queries/useBuyer";
import { statusLabel, statusColor } from "@/lib/tenderStatus";

const BuyerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const buyerName = id ? decodeURIComponent(id) : "";

  const { data, isLoading: loading } = useBuyerData(buyerName);
  const tenders = data?.tenders ?? [];
  const awards = data?.awards ?? [];

  const { totalAmount, avgAmount, topWinners } = useMemo(() => {
    const total = tenders.reduce((sum, t) => sum + (t.estimated_amount ?? 0), 0);
    const avg = tenders.length > 0 ? total / tenders.length : 0;
    const counts: Record<string, number> = {};
    awards.forEach((a) => {
      if (a.winner_name) counts[a.winner_name] = (counts[a.winner_name] ?? 0) + 1;
    });
    return {
      totalAmount: total,
      avgAmount: avg,
      topWinners: Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [tenders, awards]);

  if (loading) return <div className="text-center py-12 text-muted-foreground">Chargement...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Retour
      </Button>

      <div className="flex items-center gap-3">
        <Building2 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">{buyerName}</h1>
          <p className="text-muted-foreground">{tenders.length} appel(s) d'offres</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card border-border">
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-foreground">{tenders.length}</p>
            <p className="text-sm text-muted-foreground">AO publiés</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-foreground">{new Intl.NumberFormat("fr-FR", { notation: "compact" }).format(totalAmount)} €</p>
            <p className="text-sm text-muted-foreground">Montant total estimé</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-foreground">{new Intl.NumberFormat("fr-FR", { notation: "compact" }).format(avgAmount)} €</p>
            <p className="text-sm text-muted-foreground">Montant moyen</p>
          </CardContent>
        </Card>
      </div>

      {/* Top winners */}
      {topWinners.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Fournisseurs récurrents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topWinners.map(([name, count]) => (
              <div key={name} className="flex justify-between items-center p-2 rounded-md bg-secondary/50 text-sm">
                <span className="text-foreground">{name}</span>
                <Badge variant="secondary">{count} attribution(s)</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tender list */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-muted-foreground">Historique des appels d'offres</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tenders.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between p-3 rounded-md bg-secondary/50 text-sm cursor-pointer hover:bg-secondary/80 transition-colors"
              onClick={() => navigate(`/tenders/${t.id}`)}
            >
              <div className="flex-1 min-w-0 space-y-1">
                <p className="font-medium text-foreground truncate">{t.title}</p>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  {t.region && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{t.region}</span>}
                  {t.estimated_amount && <span className="flex items-center gap-1"><Euro className="h-3 w-3" />{new Intl.NumberFormat("fr-FR").format(t.estimated_amount)} €</span>}
                  {t.publication_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(t.publication_date), "dd MMM yyyy", { locale: fr })}</span>}
                </div>
              </div>
              {t.status && (
                <Badge variant="outline" className={statusColor[t.status] ?? ""}>
                  {statusLabel[t.status] ?? t.status}
                </Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default BuyerDetail;
