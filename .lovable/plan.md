

# Choix runtime entre OpenRouter et Anthropic direct + passage à Haiku 4.5 avec web_fetch

## Objectif

Permettre de choisir, depuis l'UI `/sourcing`, le **provider IA** utilisé pour la classification :
- **OpenRouter** (actuel) → Claude Opus 4.7, on fetche le HTML nous-mêmes côté edge function
- **Anthropic direct** (nouveau) → Claude Haiku 4.5 avec l'outil server-side `web_fetch_20250910` (Anthropic fetche l'URL pour nous, 1 seul appel API)

L'utilisateur sélectionne le provider dans un dropdown à côté du bouton "Reclassifier (via IA)". Le choix est passé à l'edge function qui dispatch vers le bon classifier.

## Comparatif des deux providers

| Critère | OpenRouter / Opus 4.7 (actuel) | Anthropic / Haiku 4.5 + web_fetch (nouveau) |
|---|---|---|
| Fetch HTML | côté edge function (`fingerprint.ts`) | côté Anthropic (server-side tool) |
| Appels API par URL | 1 fetch + 1 IA | 1 seul appel IA |
| Modèle | Claude Opus 4.7 | Claude Haiku 4.5 |
| Coût / URL | ~$0.024 | ~$0.003 |
| Coût pour 130 URLs | ~$3.10 | ~$0.40 |
| Latence | 5-8 s | 2-4 s |
| Force raisonnement | Maximum | Bon (suffisant pour classification) |
| Robustesse fetch | Notre fetch peut être bloqué (cloudflare, etc.) | Anthropic gère les redirections / headers proprement |

**Reco** : on garde OpenRouter/Opus 4.7 pour les cas tordus, on ajoute Anthropic/Haiku 4.5 comme option par défaut (8× moins cher, plus rapide, fetch fiable).

## Ce qui change

### 1. Nouveau secret Supabase
- Ajouter `ANTHROPIC_API_KEY` (clé directe Anthropic, séparée d'OpenRouter).

### 2. Nouveau classifier Anthropic direct
Création de `supabase/functions/_shared/aiClassifierAnthropic.ts` :
- Endpoint : `https://api.anthropic.com/v1/messages`
- Header beta obligatoire : `anthropic-beta: web-fetch-2025-09-10`
- Header version : `anthropic-version: 2023-06-01`
- Modèle : `claude-haiku-4-5-20251001`
- Outils :
  - `web_fetch_20250910` (server-side Anthropic) avec `max_uses: 2` et `max_content_tokens: 8000`
  - `classify_platform` (notre tool, même schéma JSON que dans le classifier actuel : enum fermé 22 plateformes + `pagination_hint`)
- Flow : on envoie juste l'URL → Claude fetche → Claude appelle notre tool → on extrait le `tool_use`
- Garde-fous : retry 3× avec backoff exponentiel sur 429/5xx, fallback silencieux sur `custom` en cas d'erreur, seuil `confidence >= 0.8` (sinon rétrogradation `custom`)
- Trace evidence : `ai:claude-haiku-4-5+web-fetch`

### 3. Refactor du classifier existant
`supabase/functions/_shared/aiClassifier.ts` (OpenRouter/Opus 4.7) reste tel quel, juste exposé via une fonction `classifyWithOpenRouter` pour cohérence de nommage.

### 4. Dispatcher
Création de `supabase/functions/_shared/classifyDispatcher.ts` :
- Signature : `classifyPlatform(url, htmlSnippet, headers, provider)` où `provider ∈ { 'openrouter', 'anthropic' }`
- Si `anthropic` → `aiClassifierAnthropic` (n'utilise pas `htmlSnippet`/`headers`, web_fetch fait le job)
- Si `openrouter` → `aiClassifier` actuel
- Défaut : `anthropic` (plus rapide, moins cher)

### 5. Edge function `reclassify-sourcing-urls`
- Accepte un nouveau champ `provider` dans le body : `'openrouter' | 'anthropic'` (défaut `anthropic`)
- Passe ce provider au dispatcher
- Si provider = `anthropic` : on skip notre fetch HTML (gain de latence) et on appelle directement le classifier Anthropic avec juste l'URL
- Si provider = `openrouter` : flow actuel inchangé (fetch HTML local + appel IA)
- Stocke `provider` dans `metadata.classification_provider` pour traçabilité

### 6. UI `/sourcing`
- Ajout d'un `<Select>` "Provider IA" à côté du bouton "Reclassifier (via IA)" :
  - Option 1 : "Anthropic Haiku 4.5 (rapide, $0.40)" — défaut
  - Option 2 : "OpenRouter Opus 4.7 (deep reasoning, $3.10)"
- État local `selectedProvider` passé dans chaque `supabase.functions.invoke('reclassify-sourcing-urls', { body: { sourcing_url_id, provider } })`
- Le toast final mentionne le provider utilisé.

### 7. Mémoire
Mise à jour `mem://architecture/strategie-ia` :
- Provider par défaut classification : Anthropic Haiku 4.5 + web_fetch
- Provider deep reasoning (option) : OpenRouter Opus 4.7
- Fallback : Lovable AI Gateway (Gemini)

## Fichiers touchés

```text
NOUVEAU  supabase/functions/_shared/aiClassifierAnthropic.ts
NOUVEAU  supabase/functions/_shared/classifyDispatcher.ts
EDIT     supabase/functions/_shared/aiClassifier.ts                 ← export nommé
EDIT     supabase/functions/reclassify-sourcing-urls/index.ts       ← param provider + dispatch
EDIT     src/pages/Sourcing.tsx                                     ← Select provider + invoke avec provider
EDIT     mem://architecture/strategie-ia                            ← stratégie 2 providers
```

Aucune migration SQL (la table `platform_fingerprints` existe déjà, son schéma `evidence jsonb` accepte la nouvelle trace sans changement).

## Plan d'exécution

1. Ajouter le secret `ANTHROPIC_API_KEY` (je te le demanderai quand on passera en mode build).
2. Créer `aiClassifierAnthropic.ts` avec web_fetch + tool calling + garde-fous.
3. Créer le dispatcher `classifyDispatcher.ts`.
4. Patcher `reclassify-sourcing-urls/index.ts` pour accepter et router selon `provider`.
5. Ajouter le `Select` provider dans `src/pages/Sourcing.tsx`.
6. Mettre à jour `mem://architecture/strategie-ia`.
7. Tu choisis "Anthropic Haiku 4.5" et tu cliques "Reclassifier (via IA)" → run à ~$0.40 sur les 130 URLs.
8. Si certaines URLs restent `custom`, tu rebascules sur "OpenRouter Opus 4.7" sur ces lignes seulement → coût marginal ~$0.50.

## Limite à connaître

`web_fetch` d'Anthropic ne contourne pas tout : si une page est protégée par JS lourd (SPA pure) ou par anti-bot Cloudflare aggressif, Anthropic verra la même page vide que nous. Pour ces cas-là, il faudra l'étape "résolution de lien acheteur" du plan précédent (extraction de liens candidats). Mais sur des portails publics standards (atexo, mpi, place, etc.), web_fetch est très fiable.

