import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, Plus, Trash2, Bell } from "lucide-react";

interface Alert {
  id: string;
  name: string;
  filters: any;
  frequency: string | null;
  enabled: boolean | null;
}

const SettingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    company_name: "", siren: "", sectors: "", regions: "", keywords: "", company_size: "",
  });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [newAlertName, setNewAlertName] = useState("");
  const [newAlertKeywords, setNewAlertKeywords] = useState("");
  const [newAlertFrequency, setNewAlertFrequency] = useState("daily");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).single().then(({ data }) => {
      if (data) {
        setProfile({
          company_name: data.company_name ?? "",
          siren: data.siren ?? "",
          sectors: (data.sectors as string[])?.join(", ") ?? "",
          regions: (data.regions as string[])?.join(", ") ?? "",
          keywords: (data.keywords as string[])?.join(", ") ?? "",
          company_size: data.company_size ?? "",
        });
      }
    });
    fetchAlerts();
  }, [user]);

  const fetchAlerts = async () => {
    if (!user) return;
    const { data } = await supabase.from("alerts").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (data) setAlerts(data as Alert[]);
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("profiles").update({
      company_name: profile.company_name || null,
      siren: profile.siren || null,
      sectors: profile.sectors.split(",").map((s) => s.trim()).filter(Boolean),
      regions: profile.regions.split(",").map((s) => s.trim()).filter(Boolean),
      keywords: profile.keywords.split(",").map((s) => s.trim()).filter(Boolean),
      company_size: profile.company_size || null,
      onboarding_completed: true,
    }).eq("user_id", user.id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profil sauvegardé ✓" });
    }
    setLoading(false);
  };

  const addAlert = async () => {
    if (!user || !newAlertName.trim()) return;
    const { error } = await supabase.from("alerts").insert({
      user_id: user.id,
      name: newAlertName.trim(),
      filters: { keywords: newAlertKeywords.split(",").map((s) => s.trim()).filter(Boolean) },
      frequency: newAlertFrequency,
      enabled: true,
    });
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Alerte créée ✓" });
      setNewAlertName("");
      setNewAlertKeywords("");
      fetchAlerts();
    }
  };

  const toggleAlert = async (alertId: string, enabled: boolean) => {
    await supabase.from("alerts").update({ enabled }).eq("id", alertId);
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, enabled } : a)));
  };

  const deleteAlert = async (alertId: string) => {
    await supabase.from("alerts").delete().eq("id", alertId);
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    toast({ title: "Alerte supprimée" });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Paramètres</h1>
        <p className="text-muted-foreground">Configurez votre profil et préférences de veille</p>
      </div>

      {/* Company info */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-foreground">Informations entreprise</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nom de l'entreprise</Label>
              <Input value={profile.company_name} onChange={(e) => setProfile({ ...profile, company_name: e.target.value })} placeholder="Ma Société SAS" />
            </div>
            <div className="space-y-2">
              <Label>SIREN</Label>
              <Input value={profile.siren} onChange={(e) => setProfile({ ...profile, siren: e.target.value })} placeholder="123 456 789" />
            </div>
            <div className="space-y-2">
              <Label>Taille entreprise</Label>
              <Input value={profile.company_size} onChange={(e) => setProfile({ ...profile, company_size: e.target.value })} placeholder="PME, ETI..." />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Watch preferences */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-foreground">Préférences de veille</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Secteurs d'activité <span className="text-xs text-muted-foreground">(séparés par des virgules)</span></Label>
            <Input value={profile.sectors} onChange={(e) => setProfile({ ...profile, sectors: e.target.value })} placeholder="BTP, Informatique, Services..." />
          </div>
          <div className="space-y-2">
            <Label>Zones géographiques <span className="text-xs text-muted-foreground">(séparées par des virgules)</span></Label>
            <Input value={profile.regions} onChange={(e) => setProfile({ ...profile, regions: e.target.value })} placeholder="Île-de-France, Auvergne-Rhône-Alpes..." />
          </div>
          <div className="space-y-2">
            <Label>Mots-clés métier <span className="text-xs text-muted-foreground">(séparés par des virgules)</span></Label>
            <Input value={profile.keywords} onChange={(e) => setProfile({ ...profile, keywords: e.target.value })} placeholder="maintenance, nettoyage, développement..." />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={loading} className="gap-2">
        <Save className="h-4 w-4" />
        {loading ? "Enregistrement..." : "Enregistrer"}
      </Button>

      {/* Alerts management */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2"><Bell className="h-5 w-5" /> Alertes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing alerts */}
          {alerts.length > 0 && (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{alert.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {alert.frequency === "daily" ? "Quotidienne" : alert.frequency === "weekly" ? "Hebdomadaire" : alert.frequency}
                      {alert.filters?.keywords?.length > 0 && ` · ${alert.filters.keywords.join(", ")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={alert.enabled ?? true} onCheckedChange={(v) => toggleAlert(alert.id, v)} />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteAlert(alert.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* New alert form */}
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

export default SettingsPage;
