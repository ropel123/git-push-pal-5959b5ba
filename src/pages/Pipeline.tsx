import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Trash2, Euro, MessageSquare, Send, Download, AlertTriangle, GripVertical } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  Stage,
  usePipelineItems,
  usePipelineComments,
  useUpdatePipelineStage,
  useRemovePipelineItem,
  useAddPipelineComment,
  type PipelineItem,
} from "@/hooks/queries/usePipeline";

const STAGES: { key: Stage; label: string; color: string }[] = [
  { key: "spotted", label: "Repéré", color: "bg-blue-500/20 text-blue-400" },
  { key: "analyzing", label: "En analyse", color: "bg-yellow-500/20 text-yellow-400" },
  { key: "no_go", label: "No Go", color: "bg-red-500/20 text-red-400" },
  { key: "responding", label: "En réponse", color: "bg-purple-500/20 text-purple-400" },
  { key: "won", label: "Gagné", color: "bg-green-500/20 text-green-400" },
  { key: "lost", label: "Perdu", color: "bg-muted text-muted-foreground" },
];

const getDeadlineIndicator = (deadline: string | null) => {
  if (!deadline) return null;
  const days = differenceInDays(new Date(deadline), new Date());
  if (days < 0) return <span className="text-xs text-destructive font-medium">Expiré</span>;
  if (days <= 3) return <span className="text-xs text-destructive font-medium flex items-center gap-0.5"><AlertTriangle className="h-3 w-3" /> {days}j</span>;
  if (days <= 7) return <span className="text-xs text-yellow-400 font-medium">{days}j</span>;
  return <span className="text-xs text-muted-foreground">{format(new Date(deadline), "dd MMM", { locale: fr })}</span>;
};

function DraggableCard({
  item,
  onOpenComments,
  onRemove,
  onNavigate,
}: {
  item: PipelineItem;
  onOpenComments: (id: string) => void;
  onRemove: (id: string) => void;
  onNavigate: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id });
  return (
    <Card
      ref={setNodeRef}
      className={`bg-card border-border ${isDragging ? "opacity-40" : ""}`}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-1">
          <button
            {...listeners}
            {...attributes}
            className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none pt-0.5"
            aria-label="Déplacer"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <p
            className="text-sm font-medium text-foreground line-clamp-2 cursor-pointer hover:text-primary transition-colors flex-1"
            onClick={() => onNavigate(item.tender_id)}
          >
            {item.tenders?.title ?? "AO supprimé"}
          </p>
        </div>
        {item.tenders?.buyer_name && <p className="text-xs text-muted-foreground pl-5">{item.tenders.buyer_name}</p>}
        <div className="flex items-center gap-2 pl-5">
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
        <div className="pl-5">{getDeadlineIndicator(item.tenders?.deadline ?? null)}</div>
        <div className="flex items-center justify-end gap-1 pt-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onOpenComments(item.id)}>
            <MessageSquare className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onRemove(item.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DroppableColumn({
  stage,
  count,
  children,
  isOver,
}: {
  stage: { key: Stage; label: string; color: string };
  count: number;
  children: React.ReactNode;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: `col-${stage.key}` });
  return (
    <div ref={setNodeRef} className="space-y-3">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className={stage.color}>{stage.label}</Badge>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      <div className={`space-y-2 min-h-[200px] rounded-lg p-1 transition-colors ${isOver ? "bg-accent/10 border border-dashed border-accent/50" : ""}`}>
        {children}
      </div>
    </div>
  );
}

const Pipeline = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const { data: items = [], isLoading: loading } = usePipelineItems(user?.id);
  const updateStage = useUpdatePipelineStage();
  const removeMutation = useRemovePipelineItem();
  const addComment = useAddPipelineComment();

  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const { data: comments = [], isLoading: commentsLoading } = usePipelineComments(activeItemId);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Stage | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const removeItem = (itemId: string) => {
    removeMutation.mutate(itemId, {
      onSuccess: () => toast({ title: "Retiré du pipeline" }),
    });
  };

  const handleAddComment = () => {
    if (!user || !activeItemId || !newComment.trim()) return;
    addComment.mutate(
      { pipeline_item_id: activeItemId, user_id: user.id, content: newComment.trim() },
      {
        onSuccess: () => setNewComment(""),
        onError: (err: any) =>
          toast({ title: "Erreur", description: err.message, variant: "destructive" }),
      },
    );
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

  const activeItem = useMemo(() => items.find((i) => i.id === draggingId) ?? null, [items, draggingId]);

  const onDragStart = (e: DragStartEvent) => setDraggingId(String(e.active.id));
  const onDragOver = (e: any) => {
    const over = e.over?.id ? String(e.over.id) : null;
    setOverCol(over?.startsWith("col-") ? (over.slice(4) as Stage) : null);
  };
  const onDragEnd = (e: DragEndEvent) => {
    const itemId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    setDraggingId(null);
    setOverCol(null);
    if (!overId || !overId.startsWith("col-")) return;
    const newStage = overId.slice(4) as Stage;
    const item = items.find((i) => i.id === itemId);
    if (!item || item.stage === newStage) return;
    updateStage.mutate({ itemId, stage: newStage });
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">Chargement...</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mes appels d'offres</h1>
          <p className="text-muted-foreground">Glissez-déposez les cartes entre les colonnes</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={items.length === 0}>
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {STAGES.map((stage) => {
            const stageItems = items.filter((i) => i.stage === stage.key);
            return (
              <DroppableColumn
                key={stage.key}
                stage={stage}
                count={stageItems.length}
                isOver={overCol === stage.key}
              >
                {stageItems.map((item) => (
                  <DraggableCard
                    key={item.id}
                    item={item}
                    onOpenComments={setActiveItemId}
                    onRemove={removeItem}
                    onNavigate={(tid) => navigate(`/tenders/${tid}`)}
                  />
                ))}
              </DroppableColumn>
            );
          })}
        </div>

        <DragOverlay>
          {activeItem ? (
            <Card className="bg-card border-accent shadow-lg w-64">
              <CardContent className="p-3">
                <p className="text-sm font-medium text-foreground line-clamp-2">
                  {activeItem.tenders?.title ?? "AO"}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Dialog open={!!activeItemId} onOpenChange={(o) => { if (!o) setActiveItemId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-sm">Commentaires</DialogTitle>
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
                  {c.created_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(c.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Ajouter un commentaire..."
              className="min-h-[60px]"
            />
            <Button size="icon" onClick={handleAddComment} disabled={!newComment.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Pipeline;

// Hidden trigger reference to satisfy unused import in older usage
void DialogTrigger;
