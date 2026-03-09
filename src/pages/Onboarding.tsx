import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, ArrowLeft, Check, Building2, MapPin, Tag, Briefcase } from "lucide-react";

const REGIONS = [
  "Auvergne-Rhône-Alpes", "Bourgogne-Franche-Comté", "Bretagne",
  "Centre-Val de Loire", "Corse", "Grand Est", "Hauts-de-France",
  "Île-de-France", "Normandie", "Nouvelle-Aquitaine", "Occitanie",
  "Pays de la Loire", "Provence-Alpes-Côte d'Azur", "Outre-mer",
];

const SECTORS = [
  "BTP & Construction", "Informatique & Numérique", "Services aux entreprises",
  "Santé & Médical", "Transport & Logistique", "Énergie & Environnement",
  "Formation & Éducation", "Communication & Marketing", "Sécurité & Défense",
  "Restauration & Hôtellerie", "Ingénierie & Conseil", "Nettoyage & Propreté",
];

const Onboarding = () => {
  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState("");
  const [siren, setSiren] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const toggleItem = (item: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  const addKeyword = () => {
    const kw = keywordInput.trim();
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw]);
      setKeywordInput("");
    }
  };

  const finish = async () => {
    if (!user) return;
    setSaving(true);
    await supabase
      .from("profiles")
      .update({
        company_name: companyName || null,
        siren: siren || null,
        company_size: companySize || null,
        sectors: selectedSectors,
        regions: selectedRegions,
        keywords,
        onboarding_completed: true,
      })
      .eq("user_id", user.id);
    setSaving(false);
    navigate("/dashboard");
  };

  const steps = [
    { icon: Building2, label: "Entreprise" },
    { icon: Briefcase, label: "Secteurs" },
    { icon: MapPin, label: "Zones" },
    { icon: Tag, label: "Mots-clés" },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Configuration initiale</h1>
          <p className="text-muted-foreground">Configurez votre profil pour recevoir des opportunités pertinentes</p>
        </div>

        {/* Step indicators */}
        <div className="flex justify-center gap-2">
          {steps.map((s, i) => (
            <div
              key={i}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                i + 1 === step
                  ? "bg-primary text-primary-foreground"
                  : i + 1 < step
                  ? "bg-primary/20 text-primary"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              <s.icon className="h-3 w-3" />
              {s.label}
            </div>
          ))}
        </div>

        <Card className="bg-card border-border">
          <CardContent className="pt-6 space-y-4">
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label>Nom de l'entreprise</Label>
                  <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Votre entreprise" />
                </div>
                <div className="space-y-2">
                  <Label>SIREN</Label>
                  <Input value={siren} onChange={(e) => setSiren(e.target.value)} placeholder="123 456 789" />
                </div>
                <div className="space-y-2">
                  <Label>Taille de l'entreprise</Label>
                  <Select value={companySize} onValueChange={setCompanySize}>
                    <SelectTrigger><SelectValue placeholder="Sélectionnez" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-9">1-9 salariés</SelectItem>
                      <SelectItem value="10-49">10-49 salariés</SelectItem>
                      <SelectItem value="50-249">50-249 salariés</SelectItem>
                      <SelectItem value="250-999">250-999 salariés</SelectItem>
                      <SelectItem value="1000+">1000+ salariés</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <Label>Secteurs d'activité (sélection multiple)</Label>
                <div className="flex flex-wrap gap-2">
                  {SECTORS.map((sector) => (
                    <Badge
                      key={sector}
                      variant={selectedSectors.includes(sector) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleItem(sector, selectedSectors, setSelectedSectors)}
                    >
                      {sector}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <Label>Zones géographiques ciblées</Label>
                <div className="flex flex-wrap gap-2">
                  {REGIONS.map((region) => (
                    <Badge
                      key={region}
                      variant={selectedRegions.includes(region) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleItem(region, selectedRegions, setSelectedRegions)}
                    >
                      {region}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3">
                <Label>Mots-clés métier</Label>
                <div className="flex gap-2">
                  <Input
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    placeholder="Ex: nettoyage industriel"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
                  />
                  <Button variant="secondary" onClick={addKeyword}>Ajouter</Button>
                </div>
                {keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {keywords.map((kw) => (
                      <Badge key={kw} variant="default" className="cursor-pointer" onClick={() => setKeywords(keywords.filter((k) => k !== kw))}>
                        {kw} ✕
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between pt-4">
              {step > 1 ? (
                <Button variant="ghost" onClick={() => setStep(step - 1)}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Précédent
                </Button>
              ) : <div />}
              {step < 4 ? (
                <Button onClick={() => setStep(step + 1)}>
                  Suivant <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={finish} disabled={saving}>
                  <Check className="h-4 w-4 mr-1" /> Terminer
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Button variant="link" className="w-full text-muted-foreground" onClick={finish}>
          Passer cette étape
        </Button>
      </div>
    </div>
  );
};

export default Onboarding;
