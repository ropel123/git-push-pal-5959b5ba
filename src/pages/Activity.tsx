import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Kanban, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useActivityFeed } from "@/hooks/queries/useActivity";

const Activity = () => {
  const { user } = useAuth();
  const { data: entries = [], isLoading: loading } = useActivityFeed(user?.id);

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
            <Card key={entry.id} className="bg-card border-border hover:border-primary/30 transition-colors">
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
