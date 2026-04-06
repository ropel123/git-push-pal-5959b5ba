import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Loader2, Copy, FileDown, FileText, Eye } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import ReactMarkdown from "react-markdown";
import TenderDocumentGenerator from "@/components/TenderDocumentGenerator";

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
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [currentResult, setCurrentResult] = useState<string | null>(null);
  const [viewingAnalysis, setViewingAnalysis] = useState<Analysis | null>(null);
  const [showDocGen, setShowDocGen] = useState(false);

  const analysesByType = (type: string) =>
    analyses.filter((a) => a.analysis_type === type).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const runAnalysis = async (type: string) => {
    if (!user) return;
    setAnalyzing(true);
    setCurrentResult(null);
    setShowTypeModal(false);

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
    toast({ title: "Copié ✓" });
  };

  const downloadAsTxt = (text: string, type: string) => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analyse_${type}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalCount = analyses.length;

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Analyse IA
              {totalCount > 0 && (
                <Badge variant="secondary" className="text-xs">{totalCount}</Badge>
              )}
            </CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowDocGen(true)} disabled={analyses.length === 0}>
                <FileText className="h-4 w-4 mr-1" /> Générer un document
              </Button>
              <Button size="sm" onClick={() => setShowTypeModal(true)} disabled={analyzing}>
                {analyzing ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Analyse en cours...</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-1" /> Analyser</>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasDocuments && (
            <p className="text-xs text-muted-foreground">
              💡 Uploadez le DCE pour une analyse plus précise.
            </p>
          )}

          {/* Current result */}
          {currentResult && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary/20 text-primary border-primary/30">Nouveau résultat</Badge>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(currentResult)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="p-4 rounded-md bg-secondary/50 text-sm text-foreground max-h-96 overflow-y-auto prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{currentResult}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Tabs by type */}
          {totalCount > 0 && (
            <Tabs defaultValue="quick" className="w-full">
              <TabsList className="w-full grid grid-cols-3">
                {analysisTypes.map((type) => {
                  const count = analysesByType(type.id).length;
                  return (
                    <TabsTrigger key={type.id} value={type.id} className="text-xs">
                      {type.label} {count > 0 && <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">{count}</Badge>}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              {analysisTypes.map((type) => (
                <TabsContent key={type.id} value={type.id} className="space-y-2 mt-3">
                  {analysesByType(type.id).length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Aucune analyse de type "{type.label}" pour le moment.
                    </p>
                  ) : (
                    analysesByType(type.id).map((a) => (
                      <div key={a.id} className="p-3 rounded-md bg-secondary/30 text-sm space-y-2 group">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(a.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
                            {a.model_used && <span className="ml-2 opacity-50">· {a.model_used}</span>}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {a.result && (
                              <>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewingAnalysis(a)} title="Voir en détail">
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(a.result!)} title="Copier">
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => downloadAsTxt(a.result!, a.analysis_type)} title="Télécharger">
                                  <FileDown className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        {a.result && (
                          <div className="text-xs text-muted-foreground line-clamp-4 prose prose-xs dark:prose-invert max-w-none">
                            <ReactMarkdown>{a.result}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Type selection modal */}
      <Dialog open={showTypeModal} onOpenChange={setShowTypeModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Choisir le type d'analyse</DialogTitle>
            <DialogDescription>
              Sélectionnez le type d'analyse IA à effectuer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {analysisTypes.map((type) => (
              <Button key={type.id} variant="outline" className="w-full justify-start h-auto py-3" onClick={() => runAnalysis(type.id)}>
                <div className="text-left">
                  <div className="font-medium">{type.label}</div>
                  <div className="text-xs text-muted-foreground">{type.desc}</div>
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Full detail view */}
      <Dialog open={!!viewingAnalysis} onOpenChange={() => setViewingAnalysis(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              {viewingAnalysis ? typeLabel[viewingAnalysis.analysis_type] || viewingAnalysis.analysis_type : ""}
            </DialogTitle>
            <DialogDescription>
              {viewingAnalysis && format(new Date(viewingAnalysis.created_at), "dd MMMM yyyy à HH:mm", { locale: fr })}
            </DialogDescription>
          </DialogHeader>
          {viewingAnalysis?.result && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(viewingAnalysis.result!)}>
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copier
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadAsTxt(viewingAnalysis.result!, viewingAnalysis.analysis_type)}>
                  <FileDown className="h-3.5 w-3.5 mr-1" /> Télécharger
                </Button>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{viewingAnalysis.result}</ReactMarkdown>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Document generator */}
      <TenderDocumentGenerator
        tenderId={tenderId}
        analyses={analyses}
        open={showDocGen}
        onOpenChange={setShowDocGen}
      />
    </>
  );
};

export default TenderAnalysisSection;
