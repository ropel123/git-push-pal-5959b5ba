# Récupérer les bonnes réponses Anthropic rejetées par seuil trop strict

## Diagnostic

Les crédits Anthropic fonctionnent maintenant (plus aucune erreur HTTP 400/402 dans les logs). Le vrai problème est **dans notre code**, pas chez Anthropic.

Log clé extrait du run :
```
[aiClassifierAnthropic] low confidence 0.72 for atexo → custom
```

Ce qui se passe pour chaque URL :
1. Haiku 4.5 fetche bien la page via `web_fetch`
2. Il identifie correctement la plateforme (ex : `atexo` à 0.72)
3. **Notre code (`aiClassifierAnthropic.ts` ligne 26 + 189) exige ≥ 0.80** → il jette le verdict et le remplace par `custom`
4. Le toast affiche `custom → custom (fallback · anthropic)`

Haiku est calibré plus prudent que Opus (qui sortait souvent 0.85-0.95). Avec un seuil hérité de l'ancien modèle, on jette ~tout ce qui sort.

## Correctif

### 1. Abaisser le seuil de confiance à 0.65 (ligne 26 de `aiClassifierAnthropic.ts`)

`0.65` est le palier standard Anthropic recommandé pour Haiku quand on a un enum fermé de 22 valeurs. Au-dessus de 0.65 le modèle a éliminé l'ambiguïté ; en dessous il hésite vraiment entre 2 plateformes.

### 2. Renforcer le prompt pour calibrer la confiance

Ajouter une section "Calibration de la confidence" dans le `SYSTEM_PROMPT` :
- **0.95-1.0** : signature explicite (hostname, classes CSS, scripts)
- **0.80-0.94** : 2+ indices convergents (path + footer + meta)
- **0.65-0.79** : 1 indice fort OU plusieurs indices faibles convergents → **réponse acceptable**
- **< 0.65** : vraiment du doute → renvoyer `platform: "custom"` directement

Cela empêche Haiku de se sous-évaluer systématiquement.

### 3. Améliorer le toast pour distinguer les vrais fallbacks

Aujourd'hui `(fallback · anthropic)` peut signifier 3 choses très différentes :
- IA a répondu mais confiance trop basse (cas actuel)
- IA a renvoyé `custom` en toute connaissance
- erreur réseau / API

Dans `reclassify-sourcing-urls/index.ts`, exposer `confidence` dans la réponse, et dans `Sourcing.tsx` afficher dans le toast quelque chose comme :
- `custom → atexo (ai · anthropic, 0.72)` ✅
- `custom → custom (low-conf 0.55 · anthropic)` ⚠️
- `custom → custom (http-500 · anthropic)` ❌

Tu sauras tout de suite si c'est un vrai custom ou une réponse jetée par seuil.

### 4. Re-tester sur 1 URL avant de relancer le batch complet

Après déploiement, tu cliques la baguette sur une URL Atexo connue (ex : ta ligne `xmarches.fr` ou un Atexo classique) → tu dois voir un verdict autre que `custom`.

## Fichiers touchés

- `supabase/functions/_shared/aiClassifierAnthropic.ts` : seuil + prompt
- `supabase/functions/reclassify-sourcing-urls/index.ts` : exposer `confidence` dans la réponse JSON
- `src/pages/Sourcing.tsx` : enrichir le toast

## Hors scope

- Aucun changement de DB
- Aucun changement sur OpenRouter/Opus (continue de marcher tel quel)
- Pas de re-classification automatique de masse — tu décideras quand relancer le bouton "Re-classifier" sur les 120 URLs après avoir validé qu'1 URL test marche
