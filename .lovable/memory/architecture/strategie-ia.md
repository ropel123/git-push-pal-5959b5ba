---
name: AI Strategy
description: Claude Opus 4.7 via OpenRouter as primary classifier, Lovable AI Gateway (Gemini) as fallback
type: feature
---

## Modèles utilisés

- **Classification de plateforme (sourcing)** : `anthropic/claude-opus-4.7` via OpenRouter (slug exact). Modèle de référence depuis avril 2026 — choisi pour le raisonnement profond sur HTML ambigu et l'extraction structurée via tool calling. `max_tokens: 600`, `temperature: 0`.
- **Analyse de tender / pricing / mémoire technique** : Claude Sonnet 4.5 via OpenRouter (rapport qualité/coût optimal pour tâches conversationnelles longues).
- **Fallback** : Lovable AI Gateway (`google/gemini-2.5-flash` ou `google/gemini-3-flash-preview`) si OpenRouter indisponible ou clé manquante.

## Règles

- Toujours appeler les LLM depuis une edge function, jamais depuis le client.
- Tool calling obligatoire pour toute sortie structurée (jamais "renvoie du JSON" en prompt).
- Logger systématiquement `ai:<modèle>` dans les `evidence[]` pour traçabilité.
