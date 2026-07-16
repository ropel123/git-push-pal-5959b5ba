// Catalogue des providers et modèles proposés dans l'admin des prompts.
// La liste sert de suggestions : un modèle personnalisé reste saisissable.

export type ProviderOption = { value: string; label: string };

export const PROVIDERS: ProviderOption[] = [
  { value: "openrouter", label: "OpenRouter" },
  { value: "lovable", label: "Lovable AI Gateway" },
];

export const MODELS_BY_PROVIDER: Record<string, { value: string; label: string }[]> = {
  openrouter: [
    { value: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
    { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
    { value: "anthropic/claude-3.5-haiku", label: "Claude 3.5 Haiku" },
    { value: "openai/gpt-4o", label: "GPT-4o" },
    { value: "openai/gpt-4o-mini", label: "GPT-4o mini" },
    { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  ],
  lovable: [
    { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (preview)" },
  ],
};

export function providerLabel(value: string): string {
  return PROVIDERS.find((p) => p.value === value)?.label ?? value;
}
