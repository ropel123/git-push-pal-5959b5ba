import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, MapPin, Euro, Calendar, Building2, FileText, Plus, Tag } from "lucide-react";
import { computeScore, getScoreColor, getScoreLabel } from "@/lib/scoring";

interface Tender {
  id: string;
  title: string;
  object: string | null;
  reference: string | null;
  buyer_name: string | null;
  buyer_siret: string | null;
  estimated_amount: number | null;
  region: string | null;
  department: string | null;
  publication_date: string | null;
  deadline: string | null;
  status: string | null;
  procedure_type: string | null;
  cpv_codes: string[] | null;
  source: string | null;
  lots: any;
}

interface AwardNotice {
  id: string;
  winner_name: string | null;
  winner_siren: string | null;
  awarded_amount: number | null;
  num_candidates: number | null;
  award_date: string | null;
  contract_duration: string | null;
}

const statusLabel: Record<string, string> = {
  open: "Ouvert",
  closed: "Clôturé",
  awarded: "Attribué",
  cancelled: "Annulé",
};

const statusColor: Record<string, string> = {
  open: "bg-green-500/20 text-green-400 border-green-500/30",
  closed: "bg-red-500/20 text-red-400 border-red-500/30",
  awarded: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  cancelled: "bg-muted text-muted-foreground",
};

const TenderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [tender, setTender] = useState<Tender | null>(null);
  const [awards, setAwards] = useState<AwardNotice[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from("tenders").select("*").eq("id", id).single(),
      supabase.from("award_notices").select("*").eq("tender_id", id),
      user ? supabase.from("profiles").select("*").eq("user_id", user.id).single() : Promise.resolve({ data: null }),
    ]).then(([tenderRes, awardsRes, profileRes]) => {
      if (tenderRes.data) setTender(tenderRes.data);
      if (awardsRes.data) setAwards(awardsRes.data);
      if (profileRes.data) setProfile(profileRes.data);
      setLoading(false);
    });
  }, [id, user]);

  const addToPipeline = async () => {
    if (!user || !id) return;
    const { error } = await supabase.from("pipeline_items").insert({
      user_id: user.id,
      tender_id: id,
      stage: "spotted" as const,
    });
    if (error?.code === "23505") {
      toast({ title: "Déjà dans le pipeline", variant: "destructive" });
    } else if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Ajouté au pipeline ✓" });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Chargement...</div>;
  }

  if (!tender) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Appel d'offres introuvable.</p>
        <Button variant="ghost" onClick={() => navigate("/tenders")} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour
        </Button>
      </div>
    );
  }

  const score = profile ? computeScore(tender, profile) : null;

  return (
    <div className="space-y-6 max-w-4xl">
      <Button variant="ghost" size="sm" onClick={() => navigate("/tenders")}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Retour aux appels d'offres
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{tender.title}</h1>
            {tender.status && (
              <Badge variant="outline" className={statusColor[tender.status] ?? ""}>
                {statusLabel[tender.status] ?? tender.status}
              </Badge>
            )}
            {score !== null && (
              <Badge variant="outline" className={getScoreColor(score)}>
                Score {score}/100 — {getScoreLabel(score)}
              </Badge>
            )}
          </div>
          {tender.reference && <p className="text-sm text-muted-foreground">Réf. {tender.reference}</p>}
        </div>
        <Button onClick={addToPipeline} className="shrink-0">
          <Plus className="h-4 w-4 mr-1" /> Ajouter au pipeline
        </Button>
      </div>

      {/* Details */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Informations générales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {tender.object && (
              <div>
                <span className="text-muted-foreground">Objet :</span>
                <p className="text-foreground mt-1">{tender.object}</p>
              </div>
            )}
            {tender.buyer_name && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <button className="text-primary hover:underline" onClick={() => navigate(`/buyers/${encodeURIComponent(tender.buyer_name!)}`)}>
                  {tender.buyer_name}
                </button>
                {tender.buyer_siret && <span className="text-muted-foreground text-xs">({tender.buyer_siret})</span>}
              </div>
            )}
            {tender.procedure_type && (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>{tender.procedure_type}</span>
              </div>
            )}
            {tender.source && (
              <div className="text-muted-foreground">Source : {tender.source}</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Détails</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {tender.estimated_amount && (
              <div className="flex items-center gap-2">
                <Euro className="h-4 w-4 text-muted-foreground" />
                <span>{new Intl.NumberFormat("fr-FR").format(tender.estimated_amount)} €</span>
              </div>
            )}
            {tender.region && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{tender.region}{tender.department ? ` (${tender.department})` : ""}</span>
              </div>
            )}
            {tender.publication_date && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Publié le {format(new Date(tender.publication_date), "dd MMMM yyyy", { locale: fr })}</span>
              </div>
            )}
            {tender.deadline && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Date limite : {format(new Date(tender.deadline), "dd MMMM yyyy à HH:mm", { locale: fr })}</span>
              </div>
            )}
            {tender.cpv_codes && tender.cpv_codes.length > 0 && (
              <div className="flex items-start gap-2">
                <Tag className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex flex-wrap gap-1">
                  {tender.cpv_codes.map((cpv) => (
                    <Badge key={cpv} variant="secondary" className="text-xs">{cpv}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lots */}
      {tender.lots && Array.isArray(tender.lots) && tender.lots.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Lots ({tender.lots.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tender.lots.map((lot: any, i: number) => (
                <div key={i} className="flex justify-between items-center p-3 rounded-md bg-secondary/50 text-sm">
                  <span className="text-foreground">{lot.title ?? `Lot ${i + 1}`}</span>
                  {lot.amount && <span className="text-muted-foreground">{new Intl.NumberFormat("fr-FR").format(lot.amount)} €</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Award notices */}
      {awards.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Avis d'attribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {awards.map((award) => (
              <div key={award.id} className="p-3 rounded-md bg-secondary/50 text-sm space-y-1">
                {award.winner_name && <p className="font-medium text-foreground">{award.winner_name}</p>}
                <div className="flex flex-wrap gap-4 text-muted-foreground text-xs">
                  {award.awarded_amount && <span>{new Intl.NumberFormat("fr-FR").format(award.awarded_amount)} €</span>}
                  {award.num_candidates && <span>{award.num_candidates} candidat(s)</span>}
                  {award.award_date && <span>{format(new Date(award.award_date), "dd MMM yyyy", { locale: fr })}</span>}
                  {award.contract_duration && <span>Durée : {award.contract_duration}</span>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TenderDetail;
