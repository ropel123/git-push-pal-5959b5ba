

# Fix : modèle OpenRouter 404 → Claude indisponible

## Diagnostic

Logs edge function clairs :
```
[aiClassifier] HTTP 404: "No endpoints found for anthropic/claude-3.5-sonnet"
[resolvePlatform] custom for host=... reasoning="http-404"
```

Pour **toutes** les URLs, l'IA renvoie `custom` parce que le slug `anthropic/claude-3.5-sonnet` n'existe plus sur OpenRouter (modèle déprécié / renommé). Du coup le pipeline tombe en `fallback` → "custom → custom (fallback)" comme tu vois dans le toast.

Rien à voir avec le HTML, la clé API, ou le prompt — juste un slug de modèle obsolète.

## Fix

Remplacer le slug dans `supabase/functions/_shared/aiClassifier.ts` :

```text
AVANT : anthropic/claude-3.5-sonnet
APRÈS : anthropic/claude-sonnet-4.5
```

Claude Sonnet 4.5 (sortie sept. 2025) est le successeur direct de 3.5 Sonnet, disponible sur OpenRouter sous `anthropic/claude-sonnet-4.5`. Tarification proche (~$3/M in, ~$15/M out), tool calling identique, donc **zéro autre changement** dans le code.

## Fichiers touchés

```text
supabase/functions/_shared/aiClassifier.ts   ← 1 ligne : MODEL constant
```

Aucune migration, aucun changement de schéma, aucun changement côté front.

## Action après le fix

Relancer le bouton **"Reclassifier (via IA)"** sur `/sourcing` → cette fois Claude répondra vraiment, et tu devrais voir la majorité des `custom` migrer vers `atexo`, `omnikles`, `domino`, `aws`, etc.

## Vérification

Après relance, je consulte les logs edge function pour confirmer qu'il n'y a plus de 404, et on regarde la nouvelle répartition par plateforme.

## Note mémoire

À mettre à jour : `mem://architecture/strategie-ia` mentionne "Claude 3.5 via OpenRouter". On passe à **Claude Sonnet 4.5** comme modèle de référence.

