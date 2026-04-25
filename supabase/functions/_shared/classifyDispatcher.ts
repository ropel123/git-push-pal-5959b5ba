// Dispatcher unique pour la classification IA — choisit entre Anthropic direct (Haiku 4.5 + web_fetch)
// et OpenRouter (Claude Opus 4.7).
import { classifyPlatformWithAI, type AIClassificationResult } from "./aiClassifier.ts";
import { classifyPlatformWithAnthropic } from "./aiClassifierAnthropic.ts";

export type AIProvider = "anthropic" | "openrouter";

export const DEFAULT_PROVIDER: AIProvider = "anthropic";

export type ClassifyArgs = {
  url: string;
  htmlSnippet?: string;
  responseHeaders?: Headers;
  provider: AIProvider;
};

export async function classifyWithProvider(args: ClassifyArgs): Promise<AIClassificationResult & { provider: AIProvider }> {
  const provider: AIProvider = args.provider === "openrouter" ? "openrouter" : "anthropic";

  if (provider === "anthropic") {
    const r = await classifyPlatformWithAnthropic(args.url);
    return { ...r, provider };
  }

  // OpenRouter : a besoin du HTML déjà fetché
  const html = args.htmlSnippet ?? "";
  const headers = args.responseHeaders ?? new Headers();
  const r = await classifyPlatformWithAI(args.url, html, headers);
  return { ...r, provider };
}

export function modelLabel(provider: AIProvider): string {
  return provider === "anthropic" ? "claude-haiku-4-5+web-fetch" : "claude-opus-4.7";
}
