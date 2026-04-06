import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, Plus, Trash2, Bell, Palette, Upload, FileText, Award } from "lucide-react";
import MemoirAIChat from "@/components/MemoirAIChat";

interface Alert {
  id: string;
  name: string;
  filters: any;
  frequency: string | null;
  enabled: boolean | null;
}

interface Reference {
  title: string;
  client: string;
  amount?: string;
  date?: string;
  description?: string;
}

const SettingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    company_name: "", siren: "", sectors: "", regions: "", keywords: "", company_size: "",
    company_description: "", company_website: "", primary_color: "#F97316", secondary_color: "#1E293B",
    company_certifications: "",
    company_skills: "",
    company_team: "",
    company_equipment: "",
    company_past_work: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [newAlertName, setNewAlertName] = useState("");
  const [newAlertKeywords, setNewAlertKeywords] = useState("");
  const [newAlertFrequency, setNewAlertFrequency] = useState("daily");
  const [references, setReferences] = useState<Reference[]>([]);
  const [newRef, setNewRef] = useState<Reference>({ title: "", client: "", amount: "", date: "", description: "" });

  const loadProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
    if (data) {
      setProfile({
        company_name: data.company_name ?? "",
        siren: data.siren ?? "",
        sectors: (data.sectors as string[])?.join(", ") ?? "",
        regions: (data.regions as string[])?.join(", ") ?? "",
        keywords: (data.keywords as string[])?.join(", ") ?? "",
        company_size: data.company_size ?? "",
        company_description: (data as any).company_description ?? "",
        company_website: (data as any).company_website ?? "",
        primary_color: (data as any).primary_color ?? "#F97316",
        secondary_color: (data as any).secondary_color ?? "#1E293B",
        company_certifications: ((data as any).company_certifications as string[])?.join(", ") ?? "",
        company_skills: (data as any).company_skills ?? "",
        company_team: (data as any).company_team ?? "",
        company_equipment: (data as any).company_equipment ?? "",
        company_past_work: (data as any).company_past_work ?? "",
      });
      if ((data as any).company_logo_path) {
        supabase.storage.from("company-assets").createSignedUrl((data as any).company_logo_path, 3600)
          .then(({ data: urlData }) => {
            if (urlData?.signedUrl) setLogoPreview(urlData.signedUrl);
          });
      }
      const refs = (data as any).company_references;
      if (Array.isArray(refs)) setReferences(refs);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadProfile();
    fetchAlerts();
  }, [user]);

  const fetchAlerts = async () => {
    if (!user) return;
    const { data } = await supabase.from("alerts").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (data) setAlerts(data as Alert[]);
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);

    let logoPath: string | undefined;
    if (logoFile) {
      const ext = logoFile.name.split(".").pop();
      const path = `${user.id}/logo.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("company-assets").upload(path, logoFile, { upsert: true });
      if (!uploadErr) logoPath = path;
    }

    const { error } = await supabase.from("profiles").update({
      company_name: profile.company_name || null,
      siren: profile.siren || null,
      sectors: profile.sectors.split(",").map((s) => s.trim()).filter(Boolean),
      regions: profile.regions.split(",").map((s) => s.trim()).filter(Boolean),
      keywords: profile.keywords.split(",").map((s) => s.trim()).filter(Boolean),
      company_size: profile.company_size || null,
      company_description: profile.company_description || null,
      company_website: profile.company_website || null,
      primary_color: profile.primary_color,
      secondary_color: profile.secondary_color,
      company_certifications: profile.company_certifications.split(",").map((s) => s.trim()).filter(Boolean),
      company_skills: profile.company_skills || null,
      company_team: profile.company_team || null,
      company_equipment: profile.company_equipment || null,
      company_past_work: profile.company_past_work || null,
      company_references: references,
      ...(logoPath ? { company_logo_path: logoPath } : {}),
      onboarding_completed: true,
    }).eq("user_id", user.id);

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profil sauvegardé ✓" });
    }
    setLoading(false);
  };

  const addReference = () => {
    if (!newRef.title.trim() || !newRef.client.trim()) return;
    setReferences([...references, { ...newRef }]);
    setNewRef({ title: "", client: "", amount: "", date: "", description: "" });
  };

  const removeReference = (index: number) => {
    setReferences(references.filter((_, i) => i !== index));
  };

  const addAlert = async () => {
    if (!user || !newAlertName.trim()) return;
    const { error } = await supabase.from("alerts").insert({
      user_id: user.id, name: newAlertName.trim(),
      filters: { keywords: newAlertKeywords.split(",").map((s) => s.trim()).filter(Boolean) },
      frequency: newAlertFrequency, enabled: true,
    });
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Alerte créée ✓" }); setNewAlertName(""); setNewAlertKeywords(""); fetchAlerts();
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
            <div className="space-y-2">
              <Label>Site web</Label>
              <Input value={profile.company_website} onChange={(e) => setProfile({ ...profile, company_website: e.target.value })} placeholder="https://..." type="url" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description de l'entreprise</Label>
            <Textarea value={profile.company_description} onChange={(e) => setProfile({ ...profile, company_description: e.target.value })} placeholder="Décrivez votre entreprise..." rows={3} />
          </div>
        </CardContent>
      </Card>

      {/* Memoir technique */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5" /> Mémoire technique
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/10 space-y-3">
            <p className="text-sm text-foreground">
              Laissez notre IA vous interviewer pour construire un mémoire technique complet et exhaustif. 
              Ces informations seront utilisées pour personnaliser vos analyses et générer des documents de réponse aux appels d'offres.
            </p>
            <MemoirAIChat onMemoirSaved={loadProfile} />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Award className="h-4 w-4 text-muted-foreground" />
                Certifications <span className="text-xs text-muted-foreground">(séparées par des virgules)</span>
              </Label>
              <Input
                value={profile.company_certifications}
                onChange={(e) => setProfile({ ...profile, company_certifications: e.target.value })}
                placeholder="ISO 9001, Qualibat, RGE, MASE..."
              />
            </div>
            <div className="space-y-2">
              <Label>Compétences clés</Label>
              <Textarea
                value={profile.company_skills}
                onChange={(e) => setProfile({ ...profile, company_skills: e.target.value })}
                placeholder="Décrivez vos compétences et savoir-faire..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Moyens humains</Label>
              <Textarea
                value={profile.company_team}
                onChange={(e) => setProfile({ ...profile, company_team: e.target.value })}
                placeholder="Effectifs, profils clés, formations..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Moyens matériels et techniques</Label>
              <Textarea
                value={profile.company_equipment}
                onChange={(e) => setProfile({ ...profile, company_equipment: e.target.value })}
                placeholder="Équipements, logiciels, véhicules..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Travaux et projets réalisés</Label>
              <Textarea
                value={profile.company_past_work}
                onChange={(e) => setProfile({ ...profile, company_past_work: e.target.value })}
                placeholder="Décrivez vos réalisations marquantes..."
                rows={6}
              />
            </div>
          </div>

          {/* References */}
          <div className="space-y-3 border-t border-border pt-4">
            <Label className="text-base font-semibold">Références entreprise</Label>
            {references.length > 0 && (
              <div className="space-y-2">
                {references.map((ref, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-md bg-secondary/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{ref.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {ref.client}
                        {ref.amount && ` · ${ref.amount}`}
                        {ref.date && ` · ${ref.date}`}
                      </p>
                      {ref.description && <p className="text-xs text-muted-foreground mt-1">{ref.description}</p>}
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeReference(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Titre du projet</Label>
                <Input value={newRef.title} onChange={(e) => setNewRef({ ...newRef, title: e.target.value })} placeholder="Construction école..." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Client</Label>
                <Input value={newRef.client} onChange={(e) => setNewRef({ ...newRef, client: e.target.value })} placeholder="Mairie de..." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Montant</Label>
                <Input value={newRef.amount} onChange={(e) => setNewRef({ ...newRef, amount: e.target.value })} placeholder="500 000 €" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <Input value={newRef.date} onChange={(e) => setNewRef({ ...newRef, date: e.target.value })} placeholder="2024" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description (optionnel)</Label>
              <Input value={newRef.description} onChange={(e) => setNewRef({ ...newRef, description: e.target.value })} placeholder="Détails du projet..." />
            </div>
            <Button variant="outline" size="sm" onClick={addReference} disabled={!newRef.title.trim() || !newRef.client.trim()} className="gap-2">
              <Plus className="h-4 w-4" /> Ajouter une référence
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Branding */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><Palette className="h-5 w-5" /> Identité visuelle</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Logo</Label>
            <div className="flex items-center gap-4">
              {logoPreview && (
                <img src={logoPreview} alt="Logo" className="h-14 w-14 object-contain rounded-md border border-border" />
              )}
              <label className="flex items-center gap-2 px-4 py-2 rounded-md border border-dashed border-border cursor-pointer hover:bg-secondary/50 transition-colors">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{logoFile ? logoFile.name : "Changer le logo"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Couleur principale</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={profile.primary_color} onChange={(e) => setProfile({ ...profile, primary_color: e.target.value })} className="h-9 w-12 rounded border border-border cursor-pointer" />
                <Input value={profile.primary_color} onChange={(e) => setProfile({ ...profile, primary_color: e.target.value })} className="font-mono text-sm" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Couleur secondaire</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={profile.secondary_color} onChange={(e) => setProfile({ ...profile, secondary_color: e.target.value })} className="h-9 w-12 rounded border border-border cursor-pointer" />
                <Input value={profile.secondary_color} onChange={(e) => setProfile({ ...profile, secondary_color: e.target.value })} className="font-mono text-sm" />
              </div>
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

      {/* Alerts */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2"><Bell className="h-5 w-5" /> Alertes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
