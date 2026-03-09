import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Kanban, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STAGE_LABELS: Record<string, string> = {
  spotted: "Repéré", analyzing: "En analyse", no_go: "No Go",
  responding: "En réponse", won: "Gagné", lost: "Perdu",
};

interface ActivityEntry {
  id: string;
  type: "pipeline" | "comment";
  date: string;
  title: string;
  detail: string;
}

const Activity = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchActivity = async () => {
      const [pipelineRes, commentsRes] = await Promise.all([
        supabase
          .from("pipeline_items")
          .select("id, stage, created_at, updated_at, tender_id, tenders(title)")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(30),
        supabase
          .from("pipeline_comments")
          .select("id, content, created_at, pipeline_item_id, pipeline_items(tender_id, tenders(title))")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      const items: ActivityEntry[] = [];

      if (pipelineRes.data) {
        for (const p of pipelineRes.data) {
          const t = p.tenders as any;
          items.push({
            id: `p-${p.id}`,
            type: "pipeline",
            date: p.updated_at ?? p.created_at ?? "",
            title: t?.title ?? "AO supprimé",
            detail: `Étape : ${STAGE_LABELS[p.stage ?? "spotted"] ?? p.stage}`,
          });
        }
      }

      if (commentsRes.data) {
        for (const c of commentsRes.data) {
          const pi = c.pipeline_items as any;
          items.push({
            id: `c-${c.id}`,
            type: "comment",
            date: c.created_at ?? "",
            title: pi?.tenders?.title ?? "AO supprimé",
            detail: c.content.length > 80 ? c.content.slice(0, 80) + "…" : c.content,
          });
        }
      }

      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setEntries(items);
      setLoading(false);
    };

    fetchActivity();
  }, [user]);

  if (loading) return <div className="text-center py-12 text-muted-foreground">Chargement...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mon activité</h1>
        <p className="text-muted-foreground">Journal de vos actions récentes</p>
      </div>

      {entries.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Aucune activité pour le moment.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <Card key={entry.id} className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer" onClick={() => {
              if (entry.type === "pipeline") {
                // Navigate could go to the tender
              }
            }}>
              <CardContent className="p-3 sm:p-4 flex items-start gap-3">
                <div className="mt-0.5">
                  {entry.type === "pipeline" ? (
                    <Kanban className="h-4 w-4 text-primary" />
                  ) : (
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{entry.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{entry.detail}</p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge variant="secondary" className="text-[10px]">
                    {entry.type === "pipeline" ? "Pipeline" : "Commentaire"}
                  </Badge>
                  {entry.date && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {format(new Date(entry.date), "dd MMM HH:mm", { locale: fr })}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Activity;
