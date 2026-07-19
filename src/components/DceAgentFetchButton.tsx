import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Sparkles, Loader2, CheckCircle2, AlertTriangle, ExternalLink, Eye } from "lucide-react";

interface Props {
  tenderId: string;
  dceUrl: string;
  onSuccess?: () => void;
}

type Status = "idle" | "running" | "success" | "no_files" | "failed";

const DceAgentFetchButton = ({ tenderId, dceUrl, onSuccess }: Props) => {
  const { toast } = useToast();
  const { isAdmin } = useIsAdmin();
  const [status, setStatus] = useState<Status>("idle");
  const [detail, setDetail] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [liveViewUrl, setLiveViewUrl] = useState<string | null>(null);
  const notifiedRef = useRef(false);
  // onSuccess vient du parent et change de référence à chaque render (fonction
  // inline). On le stocke dans un ref pour ne pas recréer l'intervalle de polling.
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  // Poll agent_runs row: live_view_url early, then final status when background finalize completes.
  // Deps volontairement limitées à [runId, status] : liveViewUrl est mis à jour via une
  // update fonctionnelle et onSuccess est lu via un ref, pour que l'intervalle ne soit
  // pas recréé à chaque render.
  useEffect(() => {
    if (!runId || status !== "running") return;
    let cancelled = false;

    const tick = async () => {
      const { data } = await supabase
        .from("agent_runs")
        .select("live_view_url,status,files_downloaded,duration_ms,cost_usd,captchas_solved,error_message")
        .eq("id", runId)
        .maybeSingle();
      if (cancelled || !data) return;

      if (data.live_view_url) setLiveViewUrl((prev) => prev ?? data.live_view_url);

      const s = (data.status ?? "") as string;
      if (["success", "no_files", "failed", "timeout"].includes(s) && !notifiedRef.current) {
        notifiedRef.current = true;
        const files = data.files_downloaded ?? 0;
        const dur = data.duration_ms ? (data.duration_ms / 1000).toFixed(1) : "?";
        const cost = typeof data.cost_usd === "number" ? data.cost_usd.toFixed(3) : "?";
        const caps = data.captchas_solved ?? 0;

        if (s === "success" && files > 0) {
          setStatus("success");
          setDetail(`${files} fichier(s) récupéré(s) — ${caps} captcha(s) résolu(s) — ${dur}s — ~${cost} $`);
          toast({ title: "Agent IA terminé ✓", description: "Le DCE a été récupéré automatiquement." });
          onSuccessRef.current?.();
        } else if (s === "no_files") {
          setStatus("no_files");
          setDetail("L'agent a complété le parcours mais aucun fichier n'a été téléchargé.");
        } else {
          setStatus("failed");
          setDetail(data.error_message ?? "Échec inconnu");
          toast({ title: "Agent en échec", description: data.error_message ?? "Échec inconnu", variant: "destructive" });
        }
      }
    };

    tick();
    const iv = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, status]);

  const launch = async () => {
    const newRunId = crypto.randomUUID();
    setStatus("running");
    setDetail("Ouverture du navigateur live…");
    setRunId(newRunId);
    setLiveViewUrl(null);
    notifiedRef.current = false;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("fetch-dce-agent", {
        body: { tender_id: tenderId, dce_url: dceUrl, triggered_by: user?.id, run_id: newRunId },
      });

      if (error) throw error;

      // Mode background : la fonction a rendu la main avant la fin de l'upload.
      // On laisse status="running" et l'effet de polling se chargera de basculer
      // en success/no_files/failed dès que agent_runs.status sera mis à jour.
      if (data?.background) {
        setDetail("Téléchargement et upload en arrière-plan…");
        return;
      }

      if (data?.success && data.files_uploaded > 0) {
        notifiedRef.current = true;
        setStatus("success");
        setDetail(
          `${data.files_uploaded} fichier(s) récupéré(s) — ${data.captchas_solved} captcha(s) résolu(s) — ${(data.duration_ms / 1000).toFixed(1)}s — ~${data.cost_usd.toFixed(3)} $`,
        );
        toast({ title: "Agent IA terminé ✓", description: "Le DCE a été récupéré automatiquement." });
        onSuccess?.();
      } else if (data?.success) {
        notifiedRef.current = true;
        setStatus("no_files");
        setDetail("L'agent a complété le parcours mais aucun fichier n'a été téléchargé.");
      } else {
        throw new Error(data?.error || "Erreur inconnue");
      }
    } catch (e: any) {
      notifiedRef.current = true;
      setStatus("failed");
      setDetail(e.message);
      toast({ title: "Agent en échec", description: e.message, variant: "destructive" });
    }
  };

  if (!isAdmin) return null;

  const showLive = liveViewUrl && (status === "running" || status === "success" || status === "no_files");

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

      {showLive && (
        <div className="space-y-2 rounded-md border border-primary/30 bg-background/50 p-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-medium">
              <Eye className="h-3.5 w-3.5 text-primary" />
              Vue en direct du navigateur de l'agent
            </div>
            <a
              href={liveViewUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              Ouvrir en grand <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="relative w-full overflow-hidden rounded border border-border bg-black" style={{ aspectRatio: "16 / 10" }}>
            <iframe
              src={liveViewUrl!}
              title="Browserbase Live View"
              className="absolute inset-0 h-full w-full"
              sandbox="allow-scripts allow-same-origin"
              allow="clipboard-read; clipboard-write"
            />
          </div>
        </div>
      )}

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
