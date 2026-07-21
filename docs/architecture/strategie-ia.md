---
name: AI Strategy
description: Two providers for platform classification (Anthropic Haiku 4.5 default, OpenRouter Opus 4.7 deep), Lovable AI Gateway as fallback
type: feature
---

## Modèles utilisés

### Classification de plateforme (sourcing) — 2 providers au choix dans l'UI `/sourcing`

- **Provider par défaut** : Anthropic API directe + `claude-haiku-4-5-20251001` + outil server-side `web_fetch_20250910`. Header beta obligatoire `anthropic-beta: web-fetch-2025-09-10`. 1 seul appel API : on envoie l'URL, Anthropic fetche la page, Claude appelle notre tool `classify_platform`. Garde-fous : `max_uses: 2`, `max_content_tokens: 8000`, retry 3× backoff exponentiel sur 429/5xx, fallback silencieux sur "custom", seuil `confidence >= 0.8`. Coût ~$0.003/URL. Secret : `ANTHROPIC_API_KEY`.
- **Provider deep reasoning** : OpenRouter + `anthropic/claude-opus-4.7` (slug exact, sorti avril 2026). On fetche le HTML nous-même côté edge function (`fingerprint.ts`), puis tool calling. `max_tokens: 600`, `temperature: 0`. Coût ~$0.024/URL. Secret : `OPENROUTER_API_KEY`.

Les deux classifiers partagent **exactement le même enum fermé** de 22 plateformes et le même schéma de sortie (`platform`, `confidence`, `reasoning`, `pagination_hint`).

### Autres usages

- **Analyse de tender / pricing / mémoire technique** : Claude Sonnet 4.5 via OpenRouter.
- **Fallback global** : Lovable AI Gateway (`google/gemini-3-flash-preview`) si OpenRouter / Anthropic indisponible.

## Règles

- Toujours appeler les LLM depuis une edge function, jamais depuis le client.
- Tool calling obligatoire pour toute sortie structurée (jamais "renvoie du JSON" en prompt).
- Logger systématiquement `ai:<modèle>` dans les `evidence[]` pour traçabilité (ex: `ai:claude-haiku-4-5+web-fetch` ou `ai:claude-opus-4.7`).
- Le provider utilisé est stocké dans `sourcing_urls.metadata.classification_provider` pour audit.

## Architecture côté code

- `supabase/functions/_shared/aiClassifier.ts` → OpenRouter / Opus 4.7
- `supabase/functions/_shared/aiClassifierAnthropic.ts` → Anthropic direct / Haiku 4.5 + web_fetch
- `supabase/functions/_shared/classifyDispatcher.ts` → dispatch selon `provider: "anthropic" | "openrouter"`
- `supabase/functions/_shared/normalize.ts` → `resolvePlatform(url, supabase, { force, provider })`
- `supabase/functions/reclassify-sourcing-urls/index.ts` → accepte `body.provider`
