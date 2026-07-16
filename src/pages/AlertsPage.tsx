import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Bell, Plus, Trash2 } from "lucide-react";
import { useAlerts, useCreateAlert, useToggleAlert, useDeleteAlert } from "@/hooks/queries/useAlerts";

const AlertsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: alerts = [] } = useAlerts(user?.id);
  const createAlertMutation = useCreateAlert();
  const toggleAlertMutation = useToggleAlert();
  const deleteAlertMutation = useDeleteAlert();

  const [newAlertName, setNewAlertName] = useState("");
  const [newAlertKeywords, setNewAlertKeywords] = useState("");
  const [newAlertFrequency, setNewAlertFrequency] = useState("daily");

  const addAlert = async () => {
    if (!user || !newAlertName.trim()) return;
    try {
      await createAlertMutation.mutateAsync({
        user_id: user.id,
        name: newAlertName.trim(),
        filters: { keywords: newAlertKeywords.split(",").map((s) => s.trim()).filter(Boolean) },
        frequency: newAlertFrequency,
        enabled: true,
      } as any);
      toast({ title: "Alerte créée ✓" });
      setNewAlertName("");
      setNewAlertKeywords("");
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Alertes de veille
          </CardTitle>
          <CardDescription>
            Recevez des notifications quand de nouveaux appels d'offres correspondent à vos critères
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {alerts.length > 0 ? (
            <div className="space-y-2">
              {alerts.map((alert: any) => (
                <div key={alert.id} className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{alert.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {alert.frequency === "daily" ? "Quotidienne" : alert.frequency === "weekly" ? "Hebdomadaire" : alert.frequency}
                      {alert.filters?.keywords?.length > 0 && ` · ${alert.filters.keywords.join(", ")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={alert.enabled ?? true}
                      onCheckedChange={(v) => toggleAlertMutation.mutate({ id: alert.id, enabled: v })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() =>
                        deleteAlertMutation.mutate(alert.id, {
                          onSuccess: () => toast({ title: "Alerte supprimée" }),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">Aucune alerte configurée</p>
          )}

          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Nouvelle alerte</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Nom</Label>
                <Input value={newAlertName} onChange={(e) => setNewAlertName(e.target.value)} placeholder="Mon alerte IT" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mots-clés (séparés par virgules)</Label>
                <Input value={newAlertKeywords} onChange={(e) => setNewAlertKeywords(e.target.value)} placeholder="informatique, cloud..." />
              </div>
            </div>
            <div className="flex items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Fréquence</Label>
                <Select value={newAlertFrequency} onValueChange={setNewAlertFrequency}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Quotidienne</SelectItem>
                    <SelectItem value="weekly">Hebdomadaire</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={addAlert} disabled={!newAlertName.trim()} className="gap-2">
                <Plus className="h-4 w-4" /> Créer
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AlertsPage;
