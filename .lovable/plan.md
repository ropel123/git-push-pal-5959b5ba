

# Fix dropdown invisible + procédure de vérification

## Pourquoi tu ne vois pas le dropdown

Sur ton viewport de 1106px, la barre du haut de `/sourcing` contient déjà 3 éléments larges (Re-classifier, Import en masse, Ajouter une URL) côte-à-côte dans un `flex gap-2` sans `flex-wrap`. En ajoutant le Select 280px, l'ensemble dépasse la largeur dispo et le navigateur **rogne ou pousse hors écran** le premier élément (le Select). Il est dans le DOM mais visuellement invisible derrière les autres ou sous le titre.

## Fix UI

Regrouper le Select + le bouton Re-classifier dans un **petit "control panel"** encadré, plus compact, et autoriser le wrap de la barre :

- `flex flex-wrap gap-2 items-center justify-end` sur le conteneur des actions → si pas la place, le bloc IA passe sur une 2ᵉ ligne au lieu d'être tronqué.
- Bloc IA avec bordure + icône baguette + label "Provider IA :" + Select compact (h-8, w-230px) + bouton "Re-classifier" → visuellement clair que les deux vont ensemble.
- Le label est masqué en < md pour gagner de la place.

```text
[Provider IA: ▼ Haiku 4.5 + web_fetch (~$0.40)] [Re-classifier]
                                                ^^^ encadré, groupé
[Import en masse] [+ Ajouter une URL]
```

## Comment vérifier que c'est opérationnel

Une fois le fix UI poussé, je te donne une **séquence de vérification en 3 étapes** :

### 1. Vérifier que le secret Anthropic est bien actif
Je ping l'edge function `reclassify-sourcing-urls` avec une URL de test et `provider: "anthropic"`. Si `ANTHROPIC_API_KEY` était manquante, on verrait `evidence: ["ai:claude-haiku-4-5+web-fetch", ..., "reasoning:no-api-key"]` dans la réponse. Sinon on a un vrai verdict.

### 2. Test A/B sur 1 URL difficile (toi, manuellement dans l'UI)
- Sélectionne **"Haiku 4.5 + web_fetch"** dans le dropdown.
- Clique l'icône baguette (Wand2) sur **une seule ligne** de la table (action `reclassifyOne`, pas le bouton "Re-classifier" global qui touche les 130).
- Le toast affiche `before → after (source · anthropic)`.
- Recommence avec **"Opus 4.7 deep"** sur la même ligne pour comparer.

### 3. Lecture des logs côté serveur (je le fais pour toi)
Après ton clic, je lis `supabase--edge_function_logs reclassify-sourcing-urls` et je te confirme :
- Le provider effectivement utilisé (`provider: "anthropic"` ou `"openrouter"` dans le body reçu).
- Pour Anthropic : présence du log `[aiClassifierAnthropic]` (warnings éventuels sur 429, low-confidence, etc.).
- La latence end-to-end (Haiku doit être ~2-4s, Opus ~5-8s).
- Le contenu de `evidence` stocké dans `metadata.platform_evidence` (lecture SQL sur `sourcing_urls`).

### 4. Vérif SQL finale (je le fais pour toi)
```sql
SELECT url, platform,
       metadata->>'classification_provider' AS provider,
       metadata->>'platform_confidence' AS conf,
       metadata->'platform_evidence' AS evidence,
       metadata->>'platform_detected_at' AS at
FROM sourcing_urls
ORDER BY (metadata->>'platform_detected_at') DESC NULLS LAST
LIMIT 5;
```
Si les 5 dernières lignes ont bien `classification_provider = "anthropic"` et un `evidence[0]` qui commence par `ai:claude-haiku-4-5+web-fetch` → c'est opérationnel.

## Plan d'exécution

1. Patcher `src/pages/Sourcing.tsx` lignes 383-396 → bloc IA encadré + flex-wrap.
2. Tu me dis quand tu vois le dropdown.
3. Tu cliques la baguette sur 1 URL avec chaque provider.
4. Je lis les logs + la table → je te confirme par écrit que les 2 providers sont opérationnels avec les vraies latences et le vrai provider tracé en base.

