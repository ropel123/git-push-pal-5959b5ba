import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, Plus, Trash2, Bell, Palette, Upload, FileText, Award, Building2, Bot, Globe, MapPin, Tag, Users, Wrench, Briefcase } from "lucide-react";
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

  const handleSaveProfile = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("profiles").update({
      company_name: profile.company_name || null,
      siren: profile.siren || null,
      sectors: profile.sectors.split(",").map((s) => s.trim()).filter(Boolean),
      regions: profile.regions.split(",").map((s) => s.trim()).filter(Boolean),
      keywords: profile.keywords.split(",").map((s) => s.trim()).filter(Boolean),
      company_size: profile.company_size || null,
      company_description: profile.company_description || null,
      company_website: profile.company_website || null,
    }).eq("user_id", user.id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profil sauvegardé ✓" });
    }
    setLoading(false);
  };

  const handleSaveMemoir = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("profiles").update({
      company_certifications: profile.company_certifications.split(",").map((s) => s.trim()).filter(Boolean),
      company_skills: profile.company_skills || null,
      company_team: profile.company_team || null,
      company_equipment: profile.company_equipment || null,
      company_past_work: profile.company_past_work || null,
      company_references: references as any,
    }).eq("user_id", user.id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Mémoire technique sauvegardé ✓" });
    }
    setLoading(false);
  };

  const handleSaveBranding = async () => {
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
      primary_color: profile.primary_color,
      secondary_color: profile.secondary_color,
      ...(logoPath ? { company_logo_path: logoPath } : {}),
    }).eq("user_id", user.id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Identité visuelle sauvegardée ✓" });
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
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Paramètres</h1>
        <p className="text-muted-foreground">Configurez votre profil, mémoire technique et préférences</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile" className="gap-2 text-xs sm:text-sm">
            <Building2 className="h-4 w-4 hidden sm:block" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="memoir" className="gap-2 text-xs sm:text-sm">
            <Bot className="h-4 w-4 hidden sm:block" />
            Mémoire IA
          </TabsTrigger>
          <TabsTrigger value="branding" className="gap-2 text-xs sm:text-sm">
            <Palette className="h-4 w-4 hidden sm:block" />
            Identité
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2 text-xs sm:text-sm">
            <Bell className="h-4 w-4 hidden sm:block" />
            Alertes
          </TabsTrigger>
        </TabsList>

        {/* ========== PROFIL ENTREPRISE ========== */}
        <TabsContent value="profile" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Informations entreprise
              </CardTitle>
              <CardDescription>Identité et coordonnées de votre société</CardDescription>
            </CardHeader>
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
                  <Label className="flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> Site web</Label>
                  <Input value={profile.company_website} onChange={(e) => setProfile({ ...profile, company_website: e.target.value })} placeholder="https://..." type="url" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description de l'entreprise</Label>
                <Textarea value={profile.company_description} onChange={(e) => setProfile({ ...profile, company_description: e.target.value })} placeholder="Décrivez votre entreprise..." rows={3} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Préférences de veille
              </CardTitle>
              <CardDescription>Secteurs, zones et mots-clés pour personnaliser vos résultats</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Tag className="h-3.5 w-3.5" /> Secteurs d'activité <span className="text-xs text-muted-foreground">(séparés par des virgules)</span></Label>
                <Input value={profile.sectors} onChange={(e) => setProfile({ ...profile, sectors: e.target.value })} placeholder="BTP, Informatique, Services..." />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Zones géographiques <span className="text-xs text-muted-foreground">(séparées par des virgules)</span></Label>
                <Input value={profile.regions} onChange={(e) => setProfile({ ...profile, regions: e.target.value })} placeholder="Île-de-France, Auvergne-Rhône-Alpes..." />
              </div>
              <div className="space-y-2">
                <Label>Mots-clés métier <span className="text-xs text-muted-foreground">(séparés par des virgules)</span></Label>
                <Input value={profile.keywords} onChange={(e) => setProfile({ ...profile, keywords: e.target.value })} placeholder="maintenance, nettoyage, développement..." />
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSaveProfile} disabled={loading} className="gap-2">
            <Save className="h-4 w-4" />
            {loading ? "Enregistrement..." : "Enregistrer le profil"}
          </Button>
        </TabsContent>

        {/* ========== MÉMOIRE TECHNIQUE ========== */}
        <TabsContent value="memoir" className="space-y-6 mt-6">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Assistant IA — Mémoire technique
              </CardTitle>
              <CardDescription>
                Notre IA vous interview pour construire un mémoire technique complet. Ces données sont utilisées pour personnaliser vos analyses et documents.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MemoirAIChat onMemoirSaved={loadProfile} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Données du mémoire
              </CardTitle>
              <CardDescription>Informations collectées par l'IA — modifiables manuellement</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
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
                <Label className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-muted-foreground" /> Compétences clés</Label>
                <Textarea
                  value={profile.company_skills}
                  onChange={(e) => setProfile({ ...profile, company_skills: e.target.value })}
                  placeholder="Décrivez vos compétences et savoir-faire..."
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /> Moyens humains</Label>
                <Textarea
                  value={profile.company_team}
                  onChange={(e) => setProfile({ ...profile, company_team: e.target.value })}
                  placeholder="Effectifs, profils clés, formations..."
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Wrench className="h-4 w-4 text-muted-foreground" /> Moyens matériels et techniques</Label>
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
            </CardContent>
          </Card>

          {/* References */}
          <Card>
            <CardHeader>
              <CardTitle>Références entreprise</CardTitle>
              <CardDescription>Projets réalisés à mettre en avant dans vos réponses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>

          <Button onClick={handleSaveMemoir} disabled={loading} className="gap-2">
            <Save className="h-4 w-4" />
            {loading ? "Enregistrement..." : "Enregistrer le mémoire"}
          </Button>
        </TabsContent>

        {/* ========== IDENTITÉ VISUELLE ========== */}
        <TabsContent value="branding" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                Identité visuelle
              </CardTitle>
              <CardDescription>Logo et couleurs utilisés dans vos documents générés</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="text-base font-medium">Logo de l'entreprise</Label>
                <div className="flex items-center gap-6">
                  <div className="h-24 w-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-secondary/30 overflow-hidden">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" className="h-full w-full object-contain p-2" />
                    ) : (
                      <Upload className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 px-4 py-2 rounded-md border border-border cursor-pointer hover:bg-secondary/50 transition-colors">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{logoFile ? logoFile.name : "Choisir un fichier"}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                    </label>
                    <p className="text-xs text-muted-foreground">PNG, JPG ou SVG. Max 2 MB.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-base font-medium">Couleur principale</Label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={profile.primary_color} onChange={(e) => setProfile({ ...profile, primary_color: e.target.value })} className="h-10 w-14 rounded-md border border-border cursor-pointer" />
                    <Input value={profile.primary_color} onChange={(e) => setProfile({ ...profile, primary_color: e.target.value })} className="font-mono text-sm" />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label className="text-base font-medium">Couleur secondaire</Label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={profile.secondary_color} onChange={(e) => setProfile({ ...profile, secondary_color: e.target.value })} className="h-10 w-14 rounded-md border border-border cursor-pointer" />
                    <Input value={profile.secondary_color} onChange={(e) => setProfile({ ...profile, secondary_color: e.target.value })} className="font-mono text-sm" />
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Aperçu</Label>
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    {logoPreview && <img src={logoPreview} alt="Logo" className="h-8 w-8 object-contain" />}
                    <span className="font-semibold text-foreground">{profile.company_name || "Votre entreprise"}</span>
                  </div>
                  <div className="flex gap-3">
                    <div className="h-8 w-24 rounded" style={{ backgroundColor: profile.primary_color }} />
                    <div className="h-8 w-24 rounded" style={{ backgroundColor: profile.secondary_color }} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSaveBranding} disabled={loading} className="gap-2">
            <Save className="h-4 w-4" />
            {loading ? "Enregistrement..." : "Enregistrer l'identité"}
          </Button>
        </TabsContent>

        {/* ========== ALERTES ========== */}
        <TabsContent value="alerts" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Alertes de veille
              </CardTitle>
              <CardDescription>Recevez des notifications quand de nouveaux appels d'offres correspondent à vos critères</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {alerts.length > 0 ? (
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
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
