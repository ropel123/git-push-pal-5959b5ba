import { useEffect, useRef, useState } from "react";
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
import { useProfile, useUpdateProfile } from "@/hooks/queries/useProfile";
import { useAlerts, useCreateAlert, useToggleAlert, useDeleteAlert } from "@/hooks/queries/useAlerts";

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
  const [newAlertName, setNewAlertName] = useState("");
  const [newAlertKeywords, setNewAlertKeywords] = useState("");
  const [newAlertFrequency, setNewAlertFrequency] = useState("daily");
  const [references, setReferences] = useState<Reference[]>([]);
  const [newRef, setNewRef] = useState<Reference>({ title: "", client: "", amount: "", date: "", description: "" });

  const { data: profileData, refetch: refetchProfile } = useProfile(user?.id);
  const { data: alerts = [] } = useAlerts(user?.id);
  const updateProfileMutation = useUpdateProfile();
  const createAlertMutation = useCreateAlert();
  const toggleAlertMutation = useToggleAlert();
  const deleteAlertMutation = useDeleteAlert();

  // Initialise le formulaire depuis la donnée serveur UNE SEULE FOIS par utilisateur.
  // Un refetch (ex: déclenché par MemoirAIChat) ne doit pas réécraser les éditions
  // non sauvegardées en cours. On rejoue l'initialisation uniquement si le user_id
  // change (nouvel utilisateur chargé).
  const initializedForUser = useRef<string | null>(null);
  useEffect(() => {
    if (!profileData) return;
    const data = profileData as any;
    if (initializedForUser.current === data.user_id) return;
    initializedForUser.current = data.user_id;
    setProfile({
      company_name: data.company_name ?? "",
      siren: data.siren ?? "",
      sectors: (data.sectors as string[])?.join(", ") ?? "",
      regions: (data.regions as string[])?.join(", ") ?? "",
      keywords: (data.keywords as string[])?.join(", ") ?? "",
      company_size: data.company_size ?? "",
      company_description: data.company_description ?? "",
      company_website: data.company_website ?? "",
      primary_color: data.primary_color ?? "#F97316",
      secondary_color: data.secondary_color ?? "#1E293B",
      company_certifications: (data.company_certifications as string[])?.join(", ") ?? "",
      company_skills: data.company_skills ?? "",
      company_team: data.company_team ?? "",
      company_equipment: data.company_equipment ?? "",
      company_past_work: data.company_past_work ?? "",
    });
    if (data.company_logo_path) {
      supabase.storage.from("company-assets").createSignedUrl(data.company_logo_path, 3600)
        .then(({ data: urlData }) => {
          if (urlData?.signedUrl) setLogoPreview(urlData.signedUrl);
        });
    }
    if (Array.isArray(data.company_references)) setReferences(data.company_references);
  }, [profileData]);

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
    try {
      await updateProfileMutation.mutateAsync({
        userId: user.id,
        patch: {
          company_name: profile.company_name || null,
          siren: profile.siren || null,
          sectors: profile.sectors.split(",").map((s) => s.trim()).filter(Boolean),
          regions: profile.regions.split(",").map((s) => s.trim()).filter(Boolean),
          keywords: profile.keywords.split(",").map((s) => s.trim()).filter(Boolean),
          company_size: profile.company_size || null,
          company_description: profile.company_description || null,
          company_website: profile.company_website || null,
        },
      });
      toast({ title: "Profil sauvegardé ✓" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMemoir = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await updateProfileMutation.mutateAsync({
        userId: user.id,
        patch: {
          company_certifications: profile.company_certifications.split(",").map((s) => s.trim()).filter(Boolean),
          company_skills: profile.company_skills || null,
          company_team: profile.company_team || null,
          company_equipment: profile.company_equipment || null,
          company_past_work: profile.company_past_work || null,
          company_references: references,
        },
      });
      toast({ title: "Mémoire technique sauvegardé ✓" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
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
    try {
      await updateProfileMutation.mutateAsync({
        userId: user.id,
        patch: {
          primary_color: profile.primary_color,
          secondary_color: profile.secondary_color,
          ...(logoPath ? { company_logo_path: logoPath } : {}),
        },
      });
      toast({ title: "Identité visuelle sauvegardée ✓" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
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
    try {
      await createAlertMutation.mutateAsync({
        user_id: user.id,
        name: newAlertName.trim(),
        filters: { keywords: newAlertKeywords.split(",").map((s) => s.trim()).filter(Boolean) },
        frequency: newAlertFrequency,
        enabled: true,
      });
      toast({ title: "Alerte créée ✓" });
      setNewAlertName("");
      setNewAlertKeywords("");
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  const toggleAlert = (alertId: string, enabled: boolean) => {
    toggleAlertMutation.mutate({ id: alertId, enabled });
  };

  const deleteAlert = (alertId: string) => {
    deleteAlertMutation.mutate(alertId, {
      onSuccess: () => toast({ title: "Alerte supprimée" }),
    });
  };


  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Paramètres</h1>
        <p className="text-muted-foreground">Configurez votre profil, mémoire technique et préférences</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
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
              <MemoirAIChat onMemoirSaved={() => { refetchProfile(); }} />
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

      </Tabs>
    </div>
  );
};

export default SettingsPage;
