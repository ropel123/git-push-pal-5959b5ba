import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Bot, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DceAutoFetchButtonProps {
  tenderId: string;
  dceUrl: string;
  onSuccess: () => void;
}

type FetchStatus = "idle" | "loading" | "success" | "enriched_only" | "failed";

const DceAutoFetchButton = ({ tenderId, dceUrl, onSuccess }: DceAutoFetchButtonProps) => {
  const { toast } = useToast();
  const [status, setStatus] = useState<FetchStatus>("idle");
  const [details, setDetails] = useState<string | null>(null);

  const handleFetch = async () => {
    setStatus("loading");
    setDetails(null);

    try {
      const { data, error } = await supabase.functions.invoke("fetch-dce", {
        body: { tender_id: tenderId, dce_url: dceUrl },
      });

      if (error) throw error;

      if (data.status === "success") {
        setStatus("success");
        setDetails(`${data.files_uploaded} fichier(s) récupéré(s) depuis ${data.platform.toUpperCase()}`);
        toast({ title: "DCE récupéré automatiquement ✓" });
        onSuccess();
      } else if (data.status === "enriched_only") {
        setStatus("enriched_only");
        setDetails("Données enrichies récupérées, mais le téléchargement du fichier nécessite un accès manuel.");
        toast({
          title: "Données enrichies",
          description: "Le DCE nécessite un téléchargement manuel, mais les informations ont été enrichies.",
        });
        onSuccess();
      } else {
        setStatus("failed");
        setDetails(data.error || "Le téléchargement automatique n'est pas disponible pour cette plateforme.");
        toast({
          title: "Téléchargement impossible",
          description: "Veuillez télécharger le DCE manuellement.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      setStatus("failed");
      setDetails(err.message || "Erreur inattendue");
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={handleFetch}
        disabled={status === "loading"}
        variant={status === "success" ? "outline" : "default"}
        className="gap-2"
      >
        {status === "loading" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Récupération en cours…
          </>
        ) : status === "success" ? (
          <>
            <CheckCircle className="h-4 w-4 text-green-500" />
            DCE récupéré
          </>
        ) : (
          <>
            <Bot className="h-4 w-4" />
            Récupérer le DCE automatiquement
          </>
        )}
      </Button>

      {details && (
        <div className="flex items-start gap-2 text-sm">
          {status === "success" && <Badge variant="secondary" className="bg-green-500/20 text-green-400">Succès</Badge>}
          {status === "enriched_only" && <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">Enrichi</Badge>}
          {status === "failed" && <Badge variant="secondary" className="bg-red-500/20 text-red-400">Manuel requis</Badge>}
          <span className="text-muted-foreground">{details}</span>
        </div>
      )}
    </div>
  );
};

export default DceAutoFetchButton;
