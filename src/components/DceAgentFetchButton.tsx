import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

interface Props {
  tenderId: string;
  dceUrl: string;
  onSuccess?: () => void;
}

type Status = "idle" | "running" | "success" | "no_files" | "failed";

const DceAgentFetchButton = ({ tenderId, dceUrl, onSuccess }: Props) => {
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>("idle");
  const [detail, setDetail] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);

  const launch = async () => {
    setStatus("running");
    setDetail("Lancement de l'agent IA navigateur…");
    setRunId(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("fetch-dce-agent", {
        body: { tender_id: tenderId, dce_url: dceUrl, triggered_by: user?.id },
      });

      if (error) throw error;
      if (data?.run_id) setRunId(data.run_id);

      if (data?.success && data.files_uploaded > 0) {
        setStatus("success");
        setDetail(
          `${data.files_uploaded} fichier(s) récupéré(s) — ${data.captchas_solved} captcha(s) résolu(s) — ${(data.duration_ms / 1000).toFixed(1)}s — ~${data.cost_usd.toFixed(3)} $`,
        );
        toast({ title: "Agent IA terminé ✓", description: "Le DCE a été récupéré automatiquement." });
        onSuccess?.();
      } else if (data?.success) {
        setStatus("no_files");
        setDetail("L'agent a complété le parcours mais aucun fichier n'a été téléchargé.");
      } else {
        throw new Error(data?.error || "Erreur inconnue");
      }
    } catch (e: any) {
      setStatus("failed");
      setDetail(e.message);
      toast({ title: "Agent en échec", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <Sparkles className="h-5 w-5 text-primary mt-0.5" />
        <div className="flex-1 space-y-1">
          <p className="font-medium text-sm">Récupération automatique par agent IA</p>
          <p className="text-xs text-muted-foreground">
            Browserbase + résolution de captchas. Coût ~0,15 $ par DCE. Idéal pour les plateformes avec login/captcha (Atexo, Marchés-Sécurisés, Maximilien…).
          </p>
        </div>
      </div>

      <Button
        onClick={launch}
        disabled={status === "running"}
        size="sm"
        variant={status === "success" ? "outline" : "default"}
        className="gap-2 w-full"
      >
        {status === "running" && <><Loader2 className="h-4 w-4 animate-spin" /> Agent en cours… (peut prendre 1-2 min)</>}
        {status === "idle" && <><Sparkles className="h-4 w-4" /> Lancer l'agent IA</>}
        {status === "success" && <><CheckCircle2 className="h-4 w-4" /> DCE récupéré</>}
        {status === "no_files" && <><AlertTriangle className="h-4 w-4" /> Relancer</>}
        {status === "failed" && <><AlertTriangle className="h-4 w-4" /> Réessayer</>}
      </Button>

      {detail && (
        <div className="flex items-start gap-2 text-xs">
          {status === "success" && <Badge variant="secondary">Succès</Badge>}
          {status === "no_files" && <Badge variant="secondary">Aucun fichier</Badge>}
          {status === "failed" && <Badge variant="destructive">Échec</Badge>}
          {status === "running" && <Badge variant="secondary">En cours</Badge>}
          <span className="text-muted-foreground">{detail}</span>
        </div>
      )}

      {runId && (
        <p className="text-[10px] text-muted-foreground font-mono">run_id: {runId}</p>
      )}
    </div>
  );
};

export default DceAgentFetchButton;
