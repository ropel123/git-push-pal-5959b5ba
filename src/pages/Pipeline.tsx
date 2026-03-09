import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChevronRight, ChevronLeft, Trash2, Euro, MessageSquare, Send, Download, AlertTriangle } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";

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
  tenders: { title: string; buyer_name: string | null; estimated_amount: number | null; deadline: string | null } | null;
}

interface Comment {
  id: string;
  content: string;
  created_at: string | null;
}

const Pipeline = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);

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

  const openComments = async (itemId: string) => {
    setActiveItemId(itemId);
    setCommentsLoading(true);
    const { data } = await supabase
      .from("pipeline_comments")
      .select("id, content, created_at")
      .eq("pipeline_item_id", itemId)
      .order("created_at", { ascending: true });
    setComments(data ?? []);
    setCommentsLoading(false);
  };

  const addComment = async () => {
    if (!user || !activeItemId || !newComment.trim()) return;
    const { data, error } = await supabase
      .from("pipeline_comments")
      .insert({ pipeline_item_id: activeItemId, user_id: user.id, content: newComment.trim() })
      .select("id, content, created_at")
      .single();
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else if (data) {
      setComments((prev) => [...prev, data]);
      setNewComment("");
    }
  };

  const exportCSV = () => {
    const headers = ["Titre", "Acheteur", "Montant estimé", "Étape", "Score", "Date limite"];
    const rows = items.map((item) => [
      `"${(item.tenders?.title ?? "").replace(/"/g, '""')}"`,
      `"${(item.tenders?.buyer_name ?? "").replace(/"/g, '""')}"`,
      item.tenders?.estimated_amount ?? "",
      STAGES.find((s) => s.key === item.stage)?.label ?? item.stage,
      item.score ?? "",
      item.tenders?.deadline ? format(new Date(item.tenders.deadline), "dd/MM/yyyy") : "",
    ]);
    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pipeline-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getDeadlineIndicator = (deadline: string | null) => {
    if (!deadline) return null;
    const days = differenceInDays(new Date(deadline), new Date());
    if (days < 0) return <span className="text-xs text-destructive font-medium">Expiré</span>;
    if (days <= 3) return <span className="text-xs text-destructive font-medium flex items-center gap-0.5"><AlertTriangle className="h-3 w-3" /> {days}j</span>;
    if (days <= 7) return <span className="text-xs text-yellow-400 font-medium">{days}j</span>;
    return <span className="text-xs text-muted-foreground">{format(new Date(deadline), "dd MMM", { locale: fr })}</span>;
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">Chargement...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pipeline</h1>
          <p className="text-muted-foreground">Suivez vos appels d'offres par étape</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={items.length === 0}>
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 overflow-x-auto">
        {STAGES.map((stage) => {
          const stageItems = items.filter((i) => i.stage === stage.key);
          return (
            <div key={stage.key} className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className={stage.color}>{stage.label}</Badge>
                <span className="text-xs text-muted-foreground">{stageItems.length}</span>
              </div>
              <div className="space-y-2 min-h-[200px]">
                {stageItems.map((item) => (
                  <Card key={item.id} className="bg-card border-border">
                    <CardContent className="p-3 space-y-2">
                      <p
                        className="text-sm font-medium text-foreground line-clamp-2 cursor-pointer hover:text-primary transition-colors"
                        onClick={() => navigate(`/tenders/${item.tender_id}`)}
                      >
                        {item.tenders?.title ?? "AO supprimé"}
                      </p>
                      {item.tenders?.buyer_name && <p className="text-xs text-muted-foreground">{item.tenders.buyer_name}</p>}
                      <div className="flex items-center gap-2">
                        {item.tenders?.estimated_amount && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Euro className="h-3 w-3" />
                            {new Intl.NumberFormat("fr-FR").format(item.tenders.estimated_amount)} €
                          </p>
                        )}
                        {item.score !== null && item.score > 0 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{item.score}/100</Badge>
                        )}
                      </div>
                      {getDeadlineIndicator(item.tenders?.deadline ?? null)}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveStage(item.id, "prev")} disabled={STAGES.findIndex((s) => s.key === item.stage) === 0}>
                            <ChevronLeft className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveStage(item.id, "next")} disabled={STAGES.findIndex((s) => s.key === item.stage) === STAGES.length - 1}>
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex gap-1">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openComments(item.id)}>
                                <MessageSquare className="h-3 w-3" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle className="text-sm">Commentaires — {item.tenders?.title}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                                {commentsLoading ? (
                                  <p className="text-sm text-muted-foreground">Chargement...</p>
                                ) : comments.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">Aucun commentaire</p>
                                ) : (
                                  comments.map((c) => (
                                    <div key={c.id} className="p-2 rounded-md bg-secondary/50 text-sm">
                                      <p className="text-foreground">{c.content}</p>
                                      {c.created_at && <p className="text-xs text-muted-foreground mt-1">{format(new Date(c.created_at), "dd MMM yyyy HH:mm", { locale: fr })}</p>}
                                    </div>
                                  ))
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Ajouter un commentaire..." className="min-h-[60px]" />
                                <Button size="icon" onClick={addComment} disabled={!newComment.trim()}>
                                  <Send className="h-4 w-4" />
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeItem(item.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
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
