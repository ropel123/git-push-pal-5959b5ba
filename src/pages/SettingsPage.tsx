import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

const SettingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    company_name: "",
    siren: "",
    sectors: "",
    regions: "",
    keywords: "",
    company_size: "",
  });

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
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
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        company_name: profile.company_name || null,
        siren: profile.siren || null,
        sectors: profile.sectors.split(",").map((s) => s.trim()).filter(Boolean),
        regions: profile.regions.split(",").map((s) => s.trim()).filter(Boolean),
        keywords: profile.keywords.split(",").map((s) => s.trim()).filter(Boolean),
        company_size: profile.company_size || null,
        onboarding_completed: true,
      })
      .eq("user_id", user.id);

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profil sauvegardé ✓" });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Paramètres</h1>
        <p className="text-muted-foreground">Configurez votre profil et préférences de veille</p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Informations entreprise</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nom de l'entreprise</Label>
              <Input
                value={profile.company_name}
                onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
                placeholder="Ma Société SAS"
              />
            </div>
            <div className="space-y-2">
              <Label>SIREN</Label>
              <Input
                value={profile.siren}
                onChange={(e) => setProfile({ ...profile, siren: e.target.value })}
                placeholder="123 456 789"
              />
            </div>
            <div className="space-y-2">
              <Label>Taille entreprise</Label>
              <Input
                value={profile.company_size}
                onChange={(e) => setProfile({ ...profile, company_size: e.target.value })}
                placeholder="PME, ETI..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Préférences de veille</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Secteurs d'activité <span className="text-xs text-muted-foreground">(séparés par des virgules)</span></Label>
            <Input
              value={profile.sectors}
              onChange={(e) => setProfile({ ...profile, sectors: e.target.value })}
              placeholder="BTP, Informatique, Services..."
            />
          </div>
          <div className="space-y-2">
            <Label>Zones géographiques <span className="text-xs text-muted-foreground">(séparées par des virgules)</span></Label>
            <Input
              value={profile.regions}
              onChange={(e) => setProfile({ ...profile, regions: e.target.value })}
              placeholder="Île-de-France, Auvergne-Rhône-Alpes..."
            />
          </div>
          <div className="space-y-2">
            <Label>Mots-clés métier <span className="text-xs text-muted-foreground">(séparés par des virgules)</span></Label>
            <Input
              value={profile.keywords}
              onChange={(e) => setProfile({ ...profile, keywords: e.target.value })}
              placeholder="maintenance, nettoyage, développement..."
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={loading} className="gap-2">
        <Save className="h-4 w-4" />
        {loading ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </div>
  );
};

export default SettingsPage;
