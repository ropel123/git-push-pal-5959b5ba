import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FileText, Presentation, Loader2, Download } from "lucide-react";
import { generatePdf } from "@/lib/generatePdf";
import { generatePptx } from "@/lib/generatePptx";

interface Analysis {
  id: string;
  analysis_type: string;
  result: string | null;
  created_at: string;
}

interface Props {
  tenderId: string;
  analyses: Analysis[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TenderDocumentGenerator = ({ tenderId, analyses, open, onOpenChange }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [format, setFormat] = useState<"pdf" | "pptx">("pdf");
  const [template, setTemplate] = useState<"memoire_technique" | "presentation">("memoire_technique");
  const [includeRefs, setIncludeRefs] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const generate = async () => {
    if (!user) return;
    setGenerating(true);
    setProgress(10);

    try {
      // Fetch profile with branding
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      setProgress(20);

      // Fetch tender data
      const { data: tender } = await supabase
        .from("tenders")
        .select("*")
        .eq("id", tenderId)
        .single();

      if (!tender) throw new Error("Tender introuvable");
      setProgress(30);

      // Call edge function to generate structured content
      const { data: aiContent, error } = await supabase.functions.invoke("generate-tender-document", {
        body: {
          tender_id: tenderId,
          document_type: format,
          template,
          include_references: includeRefs,
        },
      });

      if (error) throw error;
      if (aiContent?.error) {
        if (aiContent.error.includes("Rate limit")) {
          toast({ title: "Limite atteinte", description: "Réessayez dans quelques instants.", variant: "destructive" });
          return;
        }
        if (aiContent.error.includes("Payment required")) {
          toast({ title: "Crédits insuffisants", variant: "destructive" });
          return;
        }
        throw new Error(aiContent.error);
      }

      setProgress(70);

      // Get logo URL if available
      let logoUrl: string | undefined;
      if (profile?.company_logo_path) {
        const { data: urlData } = await supabase.storage
          .from("company-assets")
          .createSignedUrl(profile.company_logo_path, 60);
        logoUrl = urlData?.signedUrl;
      }

      const docData = {
        companyName: profile?.company_name || "Mon Entreprise",
        primaryColor: profile?.primary_color || "#F97316",
        secondaryColor: profile?.secondary_color || "#1E293B",
        logoUrl,
        tenderTitle: tender.title,
        tenderRef: tender.reference || "",
        buyerName: tender.buyer_name || "",
        deadline: tender.deadline || "",
        sections: aiContent?.sections || [],
        references: includeRefs ? (profile?.company_references as any[] || []) : [],
      };

      setProgress(85);

      if (format === "pdf") {
        await generatePdf(docData);
      } else {
        await generatePptx(docData);
      }

      setProgress(100);
      toast({ title: "Document généré ✓", description: "Le téléchargement va commencer." });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erreur de génération", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Générer un document de réponse
          </DialogTitle>
          <DialogDescription>
            Créez un document professionnel pré-rempli avec vos analyses IA et le branding de votre entreprise.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Format */}
          <div className="space-y-2">
            <Label>Format</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={format === "pdf" ? "default" : "outline"}
                className="h-auto py-3"
                onClick={() => setFormat("pdf")}
              >
                <FileText className="h-5 w-5 mr-2" />
                <div className="text-left">
                  <div className="font-medium">PDF</div>
                  <div className="text-xs opacity-70">Prêt à envoyer</div>
                </div>
              </Button>
              <Button
                variant={format === "pptx" ? "default" : "outline"}
                className="h-auto py-3"
                onClick={() => setFormat("pptx")}
              >
                <Presentation className="h-5 w-5 mr-2" />
                <div className="text-left">
                  <div className="font-medium">PowerPoint</div>
                  <div className="text-xs opacity-70">Éditable</div>
                </div>
              </Button>
            </div>
          </div>

          {/* Template */}
          <div className="space-y-2">
            <Label>Template</Label>
            <Select value={template} onValueChange={(v) => setTemplate(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="memoire_technique">Mémoire technique</SelectItem>
                <SelectItem value="presentation">Présentation entreprise</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Options */}
          <div className="flex items-center justify-between">
            <Label htmlFor="include-refs" className="cursor-pointer">Inclure les références</Label>
            <Switch id="include-refs" checked={includeRefs} onCheckedChange={setIncludeRefs} />
          </div>

          {/* Analyses available */}
          <div className="p-3 rounded-md bg-secondary/50 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{analyses.length} analyse(s)</span> seront utilisées pour pré-remplir le document.
            {analyses.length === 0 && (
              <p className="mt-1 text-amber-500">⚠️ Lancez d'abord une analyse IA pour un meilleur résultat.</p>
            )}
          </div>

          {/* Progress */}
          {generating && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">Génération en cours...</p>
            </div>
          )}

          <Button onClick={generate} disabled={generating} className="w-full">
            {generating ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Génération en cours...</>
            ) : (
              <><Download className="h-4 w-4 mr-2" /> Générer et télécharger</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TenderDocumentGenerator;
