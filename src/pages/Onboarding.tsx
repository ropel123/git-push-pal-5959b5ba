import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, Check, Palette, ArrowRight } from "lucide-react";
import MemoirAIChat from "@/components/MemoirAIChat";

const Onboarding = () => {
  const [phase, setPhase] = useState<"chat" | "branding">("chat");
  const [primaryColor, setPrimaryColor] = useState("#F97316");
  const [secondaryColor, setSecondaryColor] = useState("#1E293B");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleMemoirSaved = () => {
    setPhase("branding");
  };

  const finishBranding = async () => {
    if (!user) return;
    setSaving(true);

    let logoPath: string | null = null;
    if (logoFile) {
      const ext = logoFile.name.split(".").pop();
      const path = `${user.id}/logo.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("company-assets")
        .upload(path, logoFile, { upsert: true });
      if (!uploadErr) logoPath = path;
    }

    await supabase
      .from("profiles")
      .update({
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        ...(logoPath ? { company_logo_path: logoPath } : {}),
      })
      .eq("user_id", user.id);

    setSaving(false);
    navigate("/dashboard");
  };

  const skipToFinish = async () => {
    if (!user) return;
    setSaving(true);
    await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("user_id", user.id);
    setSaving(false);
    navigate("/dashboard");
  };

  if (phase === "branding") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Dernière étape : votre identité visuelle</h1>
            <p className="text-muted-foreground">Logo et couleurs pour vos documents de réponse</p>
          </div>

          <Card className="bg-card border-border">
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label>Logo de l'entreprise</Label>
                <div className="flex items-center gap-4">
                  {logoPreview && (
                    <img src={logoPreview} alt="Logo" className="h-16 w-16 object-contain rounded-md border border-border" />
                  )}
                  <label className="flex items-center gap-2 px-4 py-2 rounded-md border border-dashed border-border cursor-pointer hover:bg-secondary/50 transition-colors">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{logoFile ? logoFile.name : "Choisir un fichier"}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Couleur principale</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-9 w-12 rounded border border-border cursor-pointer" />
                    <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="font-mono text-sm" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Couleur secondaire</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="h-9 w-12 rounded border border-border cursor-pointer" />
                    <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="font-mono text-sm" />
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="ghost" onClick={() => navigate("/dashboard")}>
                  Passer
                </Button>
                <Button onClick={finishBranding} disabled={saving}>
                  {saving ? (
                    <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Enregistrement...</>
                  ) : (
                    <><Check className="h-4 w-4 mr-1" /> Terminer</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="text-center py-6 space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Bienvenue ! Notre IA va construire votre profil</h1>
        <p className="text-muted-foreground">Répondez aux questions pour configurer votre compte et mémoire technique</p>
      </div>

      <div className="flex-1 max-w-3xl w-full mx-auto border border-border rounded-t-lg bg-card flex flex-col min-h-0 overflow-hidden">
        <MemoirAIChat onMemoirSaved={handleMemoirSaved} mode="onboarding" />
      </div>

      <div className="text-center py-4">
        <Button variant="link" className="text-muted-foreground" onClick={skipToFinish} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
          Passer cette étape
        </Button>
      </div>
    </div>
  );
};

export default Onboarding;
