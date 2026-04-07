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
import { ArrowLeft, MapPin, Euro, Calendar, Building2, FileText, Plus, Tag, ExternalLink, Mail, Phone, Globe, MapPinned, Briefcase, FileDown, Send } from "lucide-react";
import DceUploadSection from "@/components/DceUploadSection";
import DceAutoFetchButton from "@/components/DceAutoFetchButton";
import TenderAnalysisSection from "@/components/TenderAnalysisSection";
import PricingChat from "@/components/PricingChat";
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
  source_url: string | null;
  lots: any;
  description: string | null;
  buyer_address: string | null;
  buyer_contact: any;
  execution_location: string | null;
  nuts_code: string | null;
  contract_type: string | null;
  award_criteria: string | null;
  participation_conditions: string | null;
  additional_info: string | null;
  dce_url: string | null;
  submission_url: string | null;
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
  const [dceUploads, setDceUploads] = useState<any[]>([]);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [pipelineItem, setPipelineItem] = useState<any>(null);

  const fetchDceAndAnalyses = () => {
    if (!id || !user) return;
    supabase.from("dce_uploads").select("*").eq("tender_id", id).eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setDceUploads(data || []));
    supabase.from("tender_analyses").select("*").eq("tender_id", id).eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setAnalyses(data || []));
  };

  const fetchPipelineItem = () => {
    if (!id || !user) return;
    supabase.from("pipeline_items").select("*").eq("tender_id", id).eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setPipelineItem(data));
  };

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from("tenders").select("*").eq("id", id).single(),
      supabase.from("award_notices").select("*").eq("tender_id", id),
      user ? supabase.from("profiles").select("*").eq("user_id", user.id).single() : Promise.resolve({ data: null }),
    ]).then(([tenderRes, awardsRes, profileRes]) => {
      if (tenderRes.data) setTender(tenderRes.data as any);
      if (awardsRes.data) setAwards(awardsRes.data);
      if (profileRes.data) setProfile(profileRes.data);
      setLoading(false);
    });
    fetchDceAndAnalyses();
    fetchPipelineItem();
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
      fetchPipelineItem();
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
  const contact = tender.buyer_contact && typeof tender.buyer_contact === "object" ? tender.buyer_contact : null;
  const cpvCodes = tender.cpv_codes ? [...new Set(tender.cpv_codes)] : [];

  // Helper: check if a text field is actually meaningful (not empty JSON)
  const isDisplayableText = (text: string | null | undefined): boolean => {
    if (!text || !text.trim()) return false;
    const trimmed = text.trim();
    if (trimmed === "{}" || trimmed === "[]" || trimmed === "null") return false;
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null) {
        if (Array.isArray(parsed)) return parsed.length > 0;
        const values = Object.values(parsed);
        return values.length > 0 && !values.every((v: any) => v === "" || v === null || v === undefined);
      }
    } catch { /* not JSON, it's regular text */ }
    return true;
  };

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
            {tender.contract_type && (
              <Badge variant="secondary">
                <Briefcase className="h-3 w-3 mr-1" />
                {(tender.contract_type || "").replace(/[\[\]"]/g, "")}
              </Badge>
            )}
            {score !== null && (
              <Badge variant="outline" className={getScoreColor(score)}>
                Score {score}/100 — {getScoreLabel(score)}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {tender.reference && <p className="text-sm text-muted-foreground">Réf. {tender.reference}</p>}
            {tender.source_url && (
              <a href={tender.source_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                <ExternalLink className="h-3 w-3" /> Voir l'avis original
              </a>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {tender.dce_url && (
            <Button asChild variant="outline">
              <a href={tender.dce_url} target="_blank" rel="noopener noreferrer">
                <FileDown className="h-4 w-4 mr-1" /> Accéder au DCE
              </a>
            </Button>
          )}
          {tender.submission_url && (
            <Button asChild variant="secondary">
              <a href={tender.submission_url} target="_blank" rel="noopener noreferrer">
                <Send className="h-4 w-4 mr-1" /> Déposer une offre
              </a>
            </Button>
          )}
          {pipelineItem ? (
            <Button variant="outline" disabled className="opacity-70">
              ✓ Dans le pipeline
            </Button>
          ) : (
            <Button onClick={addToPipeline}>
              <Plus className="h-4 w-4 mr-1" /> Pipeline
            </Button>
          )}
        </div>
      </div>

      {/* Description */}
      {tender.description && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Description du marché</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground whitespace-pre-line">{tender.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Details grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Informations générales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {tender.object && tender.object !== tender.title && (
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
            {tender.buyer_address && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{tender.buyer_address}</span>
              </div>
            )}
            {tender.procedure_type && (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>{tender.procedure_type}</span>
              </div>
            )}
            {tender.source && (
              <div className="text-muted-foreground">Source : {tender.source.toUpperCase()}</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Détails</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {tender.estimated_amount && tender.estimated_amount > 0 && (
              <div className="flex items-center gap-2">
                <Euro className="h-4 w-4 text-muted-foreground" />
                <span>{new Intl.NumberFormat("fr-FR").format(tender.estimated_amount)} €</span>
              </div>
            )}
            {(tender.execution_location || tender.region) && (
              <div className="flex items-center gap-2">
                <MapPinned className="h-4 w-4 text-muted-foreground" />
                <span>
                  {tender.execution_location || tender.region}
                  {tender.department ? ` (${tender.department})` : ""}
                  {tender.nuts_code ? ` — NUTS: ${tender.nuts_code}` : ""}
                </span>
              </div>
            )}
            {!tender.execution_location && !tender.region && tender.department && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>Département {tender.department}</span>
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
            {cpvCodes.length > 0 && (
              <div className="flex items-start gap-2">
                <Tag className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex flex-wrap gap-1">
                  {cpvCodes.map((cpv) => (
                    <Badge key={cpv} variant="secondary" className="text-xs">{cpv}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Contact acheteur */}
      {contact && (contact.email || contact.tel || contact.url || contact.ville) && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Contact acheteur</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 text-sm">
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-primary hover:underline">
                <Mail className="h-4 w-4" /> {contact.email}
              </a>
            )}
            {contact.tel && (
              <a href={`tel:${contact.tel}`} className="flex items-center gap-1.5 text-primary hover:underline">
                <Phone className="h-4 w-4" /> {contact.tel}
              </a>
            )}
            {contact.url && (
              <a href={contact.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
                <Globe className="h-4 w-4" /> Site web
              </a>
            )}
            {contact.ville && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-4 w-4" /> {contact.ville}{contact.pays ? `, ${contact.pays}` : ""}
              </span>
            )}
          </CardContent>
        </Card>
      )}

      {/* Critères d'attribution */}
      {isDisplayableText(tender.award_criteria) && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Critères d'attribution</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground whitespace-pre-line">{tender.award_criteria}</p>
          </CardContent>
        </Card>
      )}

      {/* Conditions de participation */}
      {isDisplayableText(tender.participation_conditions) && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Conditions de participation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground whitespace-pre-line">{tender.participation_conditions}</p>
          </CardContent>
        </Card>
      )}

      {/* Lots */}
      {tender.lots && Array.isArray(tender.lots) && tender.lots.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Lots ({tender.lots.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tender.lots.map((lot: any, i: number) => (
                <div key={i} className="p-3 rounded-md bg-secondary/50 text-sm space-y-1">
                  <div className="flex justify-between items-start">
                    <span className="text-foreground font-medium">{lot.title ?? `Lot ${lot.numero || i + 1}`}</span>
                    {lot.amount && <span className="text-muted-foreground">{new Intl.NumberFormat("fr-FR").format(lot.amount)} €</span>}
                  </div>
                  {lot.description && <p className="text-muted-foreground text-xs">{lot.description}</p>}
                  {lot.cpv && <Badge variant="secondary" className="text-xs mt-1">{lot.cpv}</Badge>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Informations complémentaires */}
      {tender.additional_info && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Informations complémentaires</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground whitespace-pre-line">{tender.additional_info}</p>
          </CardContent>
        </Card>
      )}

      {/* Auto-fetch DCE */}
      {user && id && tender.dce_url && (
        <DceAutoFetchButton
          tenderId={id}
          dceUrl={tender.dce_url}
          onSuccess={fetchDceAndAnalyses}
        />
      )}

      {/* DCE Upload */}
      {user && id && (
        <DceUploadSection
          tenderId={id}
          uploads={dceUploads}
          onUploadsChange={fetchDceAndAnalyses}
        />
      )}

      {/* AI Analysis */}
      {user && id && (
        <TenderAnalysisSection
          tenderId={id}
          hasDocuments={dceUploads.length > 0}
          analyses={analyses}
          onAnalysesChange={fetchDceAndAnalyses}
        />
      )}

      {/* Hint: add to pipeline to unlock pricing */}
      {user && id && !pipelineItem && (
        <Card className="bg-muted/50 border-dashed border-border">
          <CardContent className="py-4 text-center text-sm text-muted-foreground">
            💡 Ajoutez cet appel d'offres à votre pipeline pour accéder à l'assistant de chiffrage IA
          </CardContent>
        </Card>
      )}

      {/* Pricing Chat - visible when in pipeline */}
      {user && id && pipelineItem && (
        <PricingChat
          tenderId={id}
          pipelineItemId={pipelineItem.id}
          existingPricing={pipelineItem.pricing_strategy as any}
          onPricingSaved={fetchPipelineItem}
        />
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
