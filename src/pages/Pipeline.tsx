import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ChevronRight, ChevronLeft, Trash2, Euro } from "lucide-react";

type Stage = "spotted" | "analyzing" | "no_go" | "responding" | "won" | "lost";

const STAGES: { key: Stage; label: string; color: string }[] = [
  { key: "spotted", label: "Repéré", color: "bg-blue-500/20 text-blue-400" },
  { key: "analyzing", label: "En analyse", color: "bg-yellow-500/20 text-yellow-400" },
  { key: "no_go", label: "No Go", color: "bg-red-500/20 text-red-400" },
  { key: "responding", label: "En réponse", color: "bg-purple-500/20 text-purple-400" },
  { key: "won", label: "Gagné", color: "bg-green-500/20 text-green-400" },
  { key: "lost", label: "Perdu", color: "bg-muted text-muted-foreground" },
];

interface PipelineItem {
  id: string;
  stage: Stage;
  score: number | null;
  notes: string | null;
  tender_id: string;
  tenders: {
    title: string;
    buyer_name: string | null;
    estimated_amount: number | null;
    deadline: string | null;
  } | null;
}

const Pipeline = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchItems();
  }, [user]);

  const fetchItems = async () => {
    const { data } = await supabase
      .from("pipeline_items")
      .select("*, tenders(title, buyer_name, estimated_amount, deadline)")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });
    if (data) setItems(data as PipelineItem[]);
    setLoading(false);
  };

  const moveStage = async (itemId: string, direction: "next" | "prev") => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const currentIdx = STAGES.findIndex((s) => s.key === item.stage);
    const newIdx = direction === "next" ? currentIdx + 1 : currentIdx - 1;
    if (newIdx < 0 || newIdx >= STAGES.length) return;

    const newStage = STAGES[newIdx].key;
    await supabase.from("pipeline_items").update({ stage: newStage }).eq("id", itemId);
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, stage: newStage } : i)));
  };

  const removeItem = async (itemId: string) => {
    await supabase.from("pipeline_items").delete().eq("id", itemId);
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    toast({ title: "Retiré du pipeline" });
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pipeline</h1>
        <p className="text-muted-foreground">Suivez vos appels d'offres par étape</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {STAGES.map((stage) => {
          const stageItems = items.filter((i) => i.stage === stage.key);
          return (
            <div key={stage.key} className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className={stage.color}>
                  {stage.label}
                </Badge>
                <span className="text-xs text-muted-foreground">{stageItems.length}</span>
              </div>

              <div className="space-y-2 min-h-[200px]">
                {stageItems.map((item) => (
                  <Card key={item.id} className="bg-card border-border">
                    <CardContent className="p-3 space-y-2">
                      <p className="text-sm font-medium text-foreground line-clamp-2">
                        {item.tenders?.title ?? "AO supprimé"}
                      </p>
                      {item.tenders?.buyer_name && (
                        <p className="text-xs text-muted-foreground">{item.tenders.buyer_name}</p>
                      )}
                      {item.tenders?.estimated_amount && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Euro className="h-3 w-3" />
                          {new Intl.NumberFormat("fr-FR").format(item.tenders.estimated_amount)} €
                        </p>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => moveStage(item.id, "prev")}
                            disabled={STAGES.findIndex((s) => s.key === item.stage) === 0}
                          >
                            <ChevronLeft className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => moveStage(item.id, "next")}
                            disabled={STAGES.findIndex((s) => s.key === item.stage) === STAGES.length - 1}
                          >
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Pipeline;
