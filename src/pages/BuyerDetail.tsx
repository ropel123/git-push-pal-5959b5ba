import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, Euro, FileText, Calendar, MapPin } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface BuyerTender {
  id: string;
  title: string;
  status: string | null;
  estimated_amount: number | null;
  publication_date: string | null;
  deadline: string | null;
  region: string | null;
}

interface BuyerAward {
  id: string;
  winner_name: string | null;
  awarded_amount: number | null;
  award_date: string | null;
  tender_id: string | null;
}

const statusLabel: Record<string, string> = { open: "Ouvert", closed: "Clôturé", awarded: "Attribué", cancelled: "Annulé" };
const statusColor: Record<string, string> = {
  open: "bg-green-500/20 text-green-400 border-green-500/30",
  closed: "bg-red-500/20 text-red-400 border-red-500/30",
  awarded: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  cancelled: "bg-muted text-muted-foreground",
};

const BuyerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const buyerName = id ? decodeURIComponent(id) : "";
  const [tenders, setTenders] = useState<BuyerTender[]>([]);
  const [awards, setAwards] = useState<BuyerAward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!buyerName) return;
    Promise.all([
      supabase.from("tenders").select("id, title, status, estimated_amount, publication_date, deadline, region").eq("buyer_name", buyerName).order("publication_date", { ascending: false }),
      supabase.from("award_notices").select("id, winner_name, awarded_amount, award_date, tender_id"),
    ]).then(([tendersRes, awardsRes]) => {
      const buyerTenders = tendersRes.data ?? [];
      setTenders(buyerTenders);
      const tenderIds = buyerTenders.map((t) => t.id);
      setAwards((awardsRes.data ?? []).filter((a) => a.tender_id && tenderIds.includes(a.tender_id)));
      setLoading(false);
    });
  }, [buyerName]);

  const totalAmount = tenders.reduce((sum, t) => sum + (t.estimated_amount ?? 0), 0);
  const avgAmount = tenders.length > 0 ? totalAmount / tenders.length : 0;
  const winnerCounts: Record<string, number> = {};
  awards.forEach((a) => {
    if (a.winner_name) winnerCounts[a.winner_name] = (winnerCounts[a.winner_name] ?? 0) + 1;
  });
  const topWinners = Object.entries(winnerCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

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
