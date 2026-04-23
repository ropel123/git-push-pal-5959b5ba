

# Passage à Claude Opus 4.7 (le tout dernier d'Anthropic)

## Confirmation

Tu as raison, ma réponse précédente était fausse : **Claude Opus 4.7 existe bien**, sorti le 16 avril 2026 sur OpenRouter sous le slug `anthropic/claude-opus-4.7`. C'est le successeur direct d'Opus 4.6, taillé pour les agents long-running et le raisonnement multi-étapes — exactement notre cas d'usage (analyser un HTML ambigu et trancher entre 22 plateformes).

## Specs du modèle (depuis la page OpenRouter)

| Critère | Valeur |
|---|---|
| Slug OpenRouter | `anthropic/claude-opus-4.7` |
| Contexte | 1 000 000 tokens |
| Coût input | $5 / 1M tokens |
| Coût output | $25 / 1M tokens |
| Sortie | 16 avril 2026 |
| Force | Raisonnement profond, exécution agentique fiable, code/analyse multi-étapes |

## Coût estimé pour notre run

- 130 URLs × ~3 500 tokens in (HTML + prompt) = 455 000 tokens in → **~$2.30**
- 130 URLs × ~250 tokens out = 32 500 tokens out → **~$0.80**
- **Total : ~$3.10** pour reclassifier les 130 URLs.

C'est ~2× le coût de Sonnet 4.5 mais on parle de quelques euros pour un run one-shot, et le gain en précision sur les cas tordus le justifie largement.

## Ce qui change dans le code

Une seule constante à modifier + alignements mineurs.

```text
supabase/functions/_shared/aiClassifier.ts
  AVANT : MODEL = "anthropic/claude-sonnet-4.5"
  APRÈS : MODEL = "anthropic/claude-opus-4.7"
```

Ajustements :
- `max_tokens: 400` → `max_tokens: 600` (Opus consomme plus de tokens internes pour le raisonnement avant le tool call).
- Trace evidence : `ai:claude-opus-4.7` au lieu de `ai:claude-sonnet-4.5` dans `normalize.ts`.

## Fichiers touchés

```text
supabase/functions/_shared/aiClassifier.ts   ← MODEL + max_tokens
supabase/functions/_shared/normalize.ts      ← libellé evidence
mem://architecture/strategie-ia              ← note du nouveau modèle
```

Aucune migration. Aucun changement front. Aucune modif du prompt système (il est déjà bien calibré, Opus va juste mieux le suivre).

## Limite à garder en tête

Opus 4.7 ne va **PAS** réparer les cas où la page ne contient objectivement aucune signature de plateforme (page TYPO3 vitrine de mairie sans aucun lien sortant exploitable). Pour ces cas-là, c'est la stratégie "résolution de lien acheteur" du plan précédent qui est nécessaire.

L'enchaînement optimal reste :
1. **Maintenant** : passer à Opus 4.7 → gain immédiat sur les cas ambigus mais analysables.
2. **Ensuite (si besoin)** : ajouter l'extraction de liens candidats → gain sur les pages vitrines.

## Plan d'exécution

1. Modifier `MODEL` dans `aiClassifier.ts` → `anthropic/claude-opus-4.7`.
2. Bump `max_tokens` à 600.
3. Aligner la trace evidence côté `normalize.ts`.
4. Mettre à jour `mem://architecture/strategie-ia` (Opus 4.7 = modèle de référence).
5. Tu relances le bouton **"Reclassifier (via IA)"** sur `/sourcing`.
6. Je consulte les logs edge function pour confirmer (plus de 404, latence ~5-8 s par URL, taux de `custom` réduit).

