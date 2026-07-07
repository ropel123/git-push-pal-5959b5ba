// _shared/promptStore.ts — charge la configuration d'un prompt IA (system
// prompt + modèle + fallback) depuis la table ai_prompts, avec repli sur des
// valeurs par défaut codées en dur si la base est indisponible ou la clé absente.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type PromptConfig = {
  systemPrompt: string;
  provider: string;
  model: string;
  fallbackProvider: string | null;
  fallbackModel: string | null;
  temperature: number | null;
};

export type ResolvedProvider = {
  url: string;
  key: string;
  model: string;
  name: string;
  extraHeaders: Record<string, string>;
};

/** Construit un provider d'API chat-completions à partir de son nom logique. */
export function buildProvider(name: string, model: string): ResolvedProvider | null {
  if (name === "openrouter") {
    const key = Deno.env.get("OPENROUTER_API_KEY");
    if (!key) return null;
    return {
      url: "https://openrouter.ai/api/v1/chat/completions",
      key,
      model,
      name: "openrouter",
      extraHeaders: { "HTTP-Referer": "https://lovable.dev", "X-Title": "Hackao AI" },
    };
  }
  if (name === "lovable") {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return null;
    return {
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      key,
      model,
      name: "lovable",
      extraHeaders: {},
    };
  }
  return null;
}

/**
 * Chaîne de providers à tenter dans l'ordre (principal puis secours),
 * limitée à ceux dont la clé API est configurée.
 */
export function resolveProviderChain(config: PromptConfig): ResolvedProvider[] {
  const specs = [
    { name: config.provider, model: config.model },
    ...(config.fallbackProvider && config.fallbackModel
      ? [{ name: config.fallbackProvider, model: config.fallbackModel }]
      : []),
  ];
  return specs
    .map((s) => buildProvider(s.name, s.model))
    .filter((p): p is ResolvedProvider => p !== null);
}

export async function loadPromptConfig(
  key: string,
  defaults: PromptConfig
): Promise<PromptConfig> {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data, error } = await supabase
      .from("ai_prompts")
      .select("system_prompt, provider, model, fallback_provider, fallback_model, temperature, is_active")
      .eq("key", key)
      .maybeSingle();

    if (error || !data || data.is_active === false) {
      if (error) console.warn(`[promptStore] ${key}: ${error.message}, using defaults`);
      return defaults;
    }

    return {
      systemPrompt: data.system_prompt || defaults.systemPrompt,
      provider: data.provider || defaults.provider,
      model: data.model || defaults.model,
      fallbackProvider: data.fallback_provider ?? defaults.fallbackProvider,
      fallbackModel: data.fallback_model ?? defaults.fallbackModel,
      temperature: data.temperature ?? defaults.temperature,
    };
  } catch (e) {
    console.warn(`[promptStore] ${key} load failed, using defaults:`, e);
    return defaults;
  }
}
