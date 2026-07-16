import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useToast } from "@/hooks/use-toast";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PROVIDERS, MODELS_BY_PROVIDER, providerLabel } from "@/lib/aiModels";
import { Loader2, Save, History, Bot, RotateCcw } from "lucide-react";

type Prompt = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  provider: string;
  model: string;
  fallback_provider: string | null;
  fallback_model: string | null;
  temperature: number | null;
  system_prompt: string;
  is_active: boolean;
  version: number;
  updated_at: string;
};

type PromptVersion = {
  id: string;
  version: number;
  provider: string;
  model: string;
  fallback_provider: string | null;
  fallback_model: string | null;
  temperature: number | null;
  system_prompt: string;
  note: string | null;
  created_at: string;
};

type Draft = {
  system_prompt: string;
  provider: string;
  model: string;
  fallback_provider: string;
  fallback_model: string;
  temperature: string;
  is_active: boolean;
};

function toDraft(p: Prompt): Draft {
  return {
    system_prompt: p.system_prompt,
    provider: p.provider,
    model: p.model,
    fallback_provider: p.fallback_provider ?? "",
    fallback_model: p.fallback_model ?? "",
    temperature: p.temperature !== null ? String(p.temperature) : "",
    is_active: p.is_active,
  };
}

function ModelSelect({
  provider,
  value,
  onChange,
}: {
  provider: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const known = MODELS_BY_PROVIDER[provider] ?? [];
  const isCustom = value !== "" && !known.some((m) => m.value === value);
  return (
    <div className="space-y-1.5">
      <Select value={isCustom ? "__custom__" : value} onValueChange={(v) => onChange(v === "__custom__" ? value : v)}>
        <SelectTrigger>
          <SelectValue placeholder="Choisir un modèle" />
        </SelectTrigger>
        <SelectContent>
          {known.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
          <SelectItem value="__custom__">Personnalisé…</SelectItem>
        </SelectContent>
      </Select>
      {(isCustom || value === "") && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="identifiant/modele-personnalise"
          className="font-mono text-xs"
        />
      )}
    </div>
  );
}

const AdminPromptsPage = () => {
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [note, setNote] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: prompts, isLoading } = useQuery({
    queryKey: ["ai_prompts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_prompts")
        .select("*")
        .order("label");
      if (error) throw error;
      return data as Prompt[];
    },
    enabled: isAdmin === true,
  });

  const selected = useMemo(
    () => prompts?.find((p) => p.key === selectedKey) ?? null,
    [prompts, selectedKey]
  );

  // Sélectionne le premier prompt et initialise le brouillon.
  useEffect(() => {
    if (prompts && prompts.length > 0 && !selectedKey) {
      setSelectedKey(prompts[0].key);
    }
  }, [prompts, selectedKey]);

  useEffect(() => {
    if (selected) {
      setDraft(toDraft(selected));
      setNote("");
    }
  }, [selected]);

  const { data: versions } = useQuery({
    queryKey: ["ai_prompt_versions", selected?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_prompt_versions")
        .select("*")
        .eq("prompt_id", selected!.id)
        .order("version", { ascending: false });
      if (error) throw error;
      return data as PromptVersion[];
    },
    enabled: !!selected && historyOpen,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !draft) throw new Error("Aucun prompt sélectionné");
      if (!draft.system_prompt.trim()) throw new Error("Le system prompt ne peut pas être vide");
      if (!draft.model.trim()) throw new Error("Le modèle est requis");

      const temperature = draft.temperature.trim() === "" ? null : Number(draft.temperature);
      if (temperature !== null && (Number.isNaN(temperature) || temperature < 0 || temperature > 2)) {
        throw new Error("La température doit être comprise entre 0 et 2");
      }
      const newVersion = selected.version + 1;

      const { error: updateError } = await supabase
        .from("ai_prompts")
        .update({
          system_prompt: draft.system_prompt,
          provider: draft.provider,
          model: draft.model,
          fallback_provider: draft.fallback_provider || null,
          fallback_model: draft.fallback_model || null,
          temperature,
          is_active: draft.is_active,
          version: newVersion,
          updated_by: user?.id ?? null,
        })
        .eq("id", selected.id);
      if (updateError) throw updateError;

      // Snapshot de version (best-effort, ne bloque pas la sauvegarde).
      const { error: versionError } = await supabase.from("ai_prompt_versions").insert({
        prompt_id: selected.id,
        version: newVersion,
        provider: draft.provider,
        model: draft.model,
        fallback_provider: draft.fallback_provider || null,
        fallback_model: draft.fallback_model || null,
        temperature,
        system_prompt: draft.system_prompt,
        note: note.trim() || null,
        created_by: user?.id ?? null,
      });
      if (versionError) console.warn("Snapshot de version échoué:", versionError);
    },
    onSuccess: () => {
      toast({ title: "Prompt enregistré ✓", description: "Une nouvelle version a été créée." });
      qc.invalidateQueries({ queryKey: ["ai_prompts"] });
      qc.invalidateQueries({ queryKey: ["ai_prompt_versions", selected?.id] });
    },
    onError: (e) => {
      toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
    },
  });

  const restoreVersion = (v: PromptVersion) => {
    setDraft({
      system_prompt: v.system_prompt,
      provider: v.provider,
      model: v.model,
      fallback_provider: v.fallback_provider ?? "",
      fallback_model: v.fallback_model ?? "",
      temperature: v.temperature !== null ? String(v.temperature) : "",
      is_active: draft?.is_active ?? true,
    });
    setNote(`Restauration de la version ${v.version}`);
    setHistoryOpen(false);
    toast({ title: `Version ${v.version} chargée`, description: "Enregistrez pour l'appliquer." });
  };

  if (adminLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const dirty = selected && draft && JSON.stringify(draft) !== JSON.stringify(toDraft(selected));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" />
          Prompts IA
        </h1>
        <p className="text-muted-foreground text-sm">
          Gérez les instructions et les modèles des assistants IA (mémoire technique d'onboarding et fonctions à venir).
          Chaque enregistrement crée une nouvelle version.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !prompts || prompts.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Aucun prompt configuré pour le moment.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
          {/* Liste des prompts */}
          <div className="space-y-2">
            {prompts.map((p) => (
              <button
                key={p.key}
                onClick={() => setSelectedKey(p.key)}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${
                  p.key === selectedKey
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm text-foreground">{p.label}</span>
                  {!p.is_active && <Badge variant="outline" className="text-[10px]">inactif</Badge>}
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{p.key}</p>
              </button>
            ))}
          </div>

          {/* Éditeur */}
          {selected && draft && (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">{selected.label}</CardTitle>
                  {selected.description && (
                    <p className="text-sm text-muted-foreground mt-1">{selected.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">Version actuelle : v{selected.version}</p>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setHistoryOpen(true)}>
                  <History className="h-3.5 w-3.5" />
                  Historique
                </Button>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draft.is_active}
                    onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
                    id="active"
                  />
                  <Label htmlFor="active" className="cursor-pointer">
                    Actif {draft.is_active ? "" : "(les valeurs par défaut du code seront utilisées)"}
                  </Label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Provider principal</Label>
                    <Select
                      value={draft.provider}
                      onValueChange={(v) => setDraft({ ...draft, provider: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVIDERS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Modèle principal</Label>
                    <ModelSelect
                      provider={draft.provider}
                      value={draft.model}
                      onChange={(v) => setDraft({ ...draft, model: v })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Provider de secours (optionnel)</Label>
                    <Select
                      value={draft.fallback_provider || "__none__"}
                      onValueChange={(v) =>
                        setDraft({ ...draft, fallback_provider: v === "__none__" ? "" : v, fallback_model: v === "__none__" ? "" : draft.fallback_model })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Aucun</SelectItem>
                        {PROVIDERS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {draft.fallback_provider && (
                    <div className="space-y-1.5">
                      <Label>Modèle de secours</Label>
                      <ModelSelect
                        provider={draft.fallback_provider}
                        value={draft.fallback_model}
                        onChange={(v) => setDraft({ ...draft, fallback_model: v })}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 max-w-[200px]">
                  <Label>Température (optionnel)</Label>
                  <Input
                    value={draft.temperature}
                    onChange={(e) => setDraft({ ...draft, temperature: e.target.value })}
                    placeholder="ex: 0.7"
                    inputMode="decimal"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>System prompt</Label>
                  <Textarea
                    value={draft.system_prompt}
                    onChange={(e) => setDraft({ ...draft, system_prompt: e.target.value })}
                    className="font-mono text-xs min-h-[320px] leading-relaxed"
                  />
                  <p className="text-xs text-muted-foreground">{draft.system_prompt.length} caractères</p>
                </div>

                <div className="space-y-1.5">
                  <Label>Note de version (optionnel)</Label>
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ex : ton plus direct, ajout question sécurité"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground"
                    onClick={() => setDraft(toDraft(selected))}
                    disabled={!dirty}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Annuler les modifications
                  </Button>
                  <Button
                    className="gap-2"
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending || !dirty}
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Enregistrer une nouvelle version
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Historique des versions — {selected?.label}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto space-y-3 pr-1">
            {!versions || versions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Aucune version enregistrée.</p>
            ) : (
              versions.map((v) => (
                <div key={v.id} className="border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">v{v.version}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(v.created_at).toLocaleString("fr-FR")}
                      </span>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => restoreVersion(v)}>
                      <RotateCcw className="h-3 w-3" />
                      Restaurer
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {providerLabel(v.provider)} · <span className="font-mono">{v.model}</span>
                    {v.temperature !== null && ` · temp ${v.temperature}`}
                  </p>
                  {v.note && <p className="text-xs italic text-foreground">« {v.note} »</p>}
                  <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                    {v.system_prompt.slice(0, 300)}…
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPromptsPage;
