import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Copy, FileDown, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Analysis {
  id: string;
  analysis_type: string;
  result: string | null;
  model_used: string | null;
  tokens_used: number | null;
  created_at: string;
}

interface TenderAnalysisSectionProps {
  tenderId: string;
  hasDocuments: boolean;
  analyses: Analysis[];
  onAnalysesChange: () => void;
}

const analysisTypes = [
  { id: "quick", label: "Analyse rapide", desc: "Résumé, go/no-go, points clés" },
  { id: "technical", label: "Mémoire technique", desc: "Brouillon structuré complet" },
  { id: "strategy", label: "Recommandations", desc: "Stratégie de réponse optimale" },
];

const typeLabel: Record<string, string> = {
  quick: "Analyse rapide",
  technical: "Mémoire technique",
  strategy: "Recommandations",
};

const TenderAnalysisSection = ({ tenderId, hasDocuments, analyses, onAnalysesChange }: TenderAnalysisSectionProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [currentResult, setCurrentResult] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const runAnalysis = async (type: string) => {
    if (!user) return;
    setAnalyzing(true);
    setCurrentResult(null);
    setShowModal(false);

    try {
      const { data, error } = await supabase.functions.invoke("analyze-tender", {
        body: { tender_id: tenderId, analysis_type: type },
      });

      if (error) throw error;

      if (data?.error) {
        if (data.error.includes("Rate limit")) {
          toast({ title: "Limite atteinte", description: "Veuillez réessayer dans quelques instants.", variant: "destructive" });
        } else if (data.error.includes("Payment required")) {
          toast({ title: "Crédits insuffisants", description: "Ajoutez des crédits dans Settings > Workspace > Usage.", variant: "destructive" });
        } else {
          throw new Error(data.error);
        }
        return;
      }

      setCurrentResult(data?.result || "Aucun résultat");
      toast({ title: "Analyse terminée ✓" });
      onAnalysesChange();
    } catch (err: any) {
      toast({ title: "Erreur d'analyse", description: err.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copié dans le presse-papiers ✓" });
  };

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Analyse IA
            </CardTitle>
            <Button
              size="sm"
              onClick={() => setShowModal(true)}
              disabled={analyzing}
            >
              {analyzing ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Analyse en cours...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-1" /> Analyser avec l'IA</>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasDocuments && (
            <p className="text-xs text-muted-foreground">
              💡 Uploadez le DCE pour une analyse plus précise. L'IA peut aussi analyser les informations disponibles dans l'appel d'offres.
            </p>
          )}

          {/* Current result */}
          {currentResult && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Nouveau résultat</Badge>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(currentResult)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="p-3 rounded-md bg-secondary/50 text-sm text-foreground whitespace-pre-wrap max-h-96 overflow-y-auto">
                {currentResult}
              </div>
            </div>
          )}

          {/* History */}
          {analyses.length > 0 && (
            <div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => setShowHistory(!showHistory)}
              >
                {showHistory ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                {analyses.length} analyse(s) précédente(s)
              </Button>
              {showHistory && (
                <div className="space-y-2 mt-2">
                  {analyses.map((a) => (
                    <div key={a.id} className="p-3 rounded-md bg-secondary/30 text-sm space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">{typeLabel[a.analysis_type] || a.analysis_type}</Badge>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(a.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
                          </span>
                          {a.result && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(a.result!)}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      {a.result && (
                        <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{a.result}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal choix du type */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Choisir le type d'analyse</DialogTitle>
            <DialogDescription>
              Sélectionnez le type d'analyse IA à effectuer sur cet appel d'offres.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {analysisTypes.map((type) => (
              <Button
                key={type.id}
                variant="outline"
                className="w-full justify-start h-auto py-3"
                onClick={() => runAnalysis(type.id)}
              >
                <div className="text-left">
                  <div className="font-medium">{type.label}</div>
                  <div className="text-xs text-muted-foreground">{type.desc}</div>
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TenderAnalysisSection;
