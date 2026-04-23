

# Classification IA en premier plan — pipeline simplifié via OpenRouter (Claude)

## Idée

Au lieu d'empiler 4 niveaux (cache → hostname regex → sonde HTTP regex → IA), on **simplifie radicalement** : l'IA est le moteur principal. Le cache reste, le reste disparaît.

```text
AVANT : Cache → Hostname regex → Sonde HTTP regex → IA → fallback
APRÈS : Cache → IA (avec contexte URL + HTML) → fallback
```

## Pourquoi c'est plus simple (et meilleur)

- **Moins de code** : suppression de `fingerprint.ts` (regex statiques fragiles), suppression de la grosse fonction `detectPlatformFromUrlInternal` dans `normalize.ts` côté détection (on la garde juste pour validation finale).
- **Une seule source de vérité** : Claude voit URL + HTML + headers d'un coup et tranche. Plus de "le hostname dit X mais la sonde dit Y" à arbitrer.
- **Couvre les cas tordus dès le départ** : pas besoin d'écrire 30 règles regex pour Omnikles, AJI, AWS, eu-supply, Notes Domino — Claude les reconnaît nativement.
- **Bonus pagination** : Claude renvoie aussi `pagination_hint` (`url`/`actions`/`single`) en lisant le DOM → préparé pour la prochaine étape scraping multi-page.

## Ce qu'on garde quand même

- **Cache `platform_fingerprints`** (24 h par hostname) : 1 seul appel IA par host, jamais répété → coût maîtrisé.
- **Validation enum stricte** côté tool calling : Claude ne peut renvoyer que des valeurs de la liste blanche `PLATFORMS`. Si confidence < 0.6 → `custom`.
- **Fallback hostname ultra-court** : juste pour les 5-6 hosts évidents où on veut une réponse instantanée sans appel réseau (`marches-publics.gouv.fr` → `place`, etc.). Reste optionnel.

## Architecture finale

```text
resolvePlatform(url, supabase):
  1. Cache hit récent (< 24h) ? → return
  2. Téléchargement HTML (1 GET, 8 ko)
  3. Appel Claude via OpenRouter avec { url, html, headers }
  4. Si confidence ≥ 0.6 → cache + return
  5. Sinon → "custom" + log warning
```

## Provider : OpenRouter + Claude 3.5 Sonnet

Endpoint : `POST https://openrouter.ai/api/v1/chat/completions`
Auth : `Bearer ${OPENROUTER_API_KEY}` (déjà présent dans les secrets)
Modèle : `anthropic/claude-3.5-sonnet` (cohérent avec `mem://architecture/strategie-ia`)

Tool calling forcé pour réponse structurée :

```json
{
  "platform": "atexo|mpi|place|achatpublic|e-marchespublics|marches-securises|klekoon|xmarches|maximilien|megalis|ternum|aura|safetender|omnikles|aws|eu-supply|synapse|centrale-marches|francemarches|aji|domino|custom",
  "confidence": 0.0-1.0,
  "reasoning": "1 phrase",
  "pagination_hint": "url|actions|single|unknown"
}
```

## Garde-fous

- **Threshold 0.6** : sinon `custom` (mieux ne pas savoir que mal classer).
- **Enum fermé** : Claude ne peut pas inventer.
- **Retry 1×** sur 429 (backoff 2 s).
- **Fallback silencieux** : si OpenRouter down ou key invalide → `custom`, run continue.
- **Cache prioritaire** : si déjà classifié < 24 h, zéro appel IA.
- **Pas de boucle infinie** : 1 appel max par URL et par run.

## Fichiers touchés

```text
supabase/functions/_shared/aiClassifier.ts            ← NEW : appel OpenRouter + tool calling
supabase/functions/_shared/normalize.ts               ← simplifie resolvePlatform() (~60 lignes en moins)
supabase/functions/_shared/fingerprint.ts             ← garde uniquement le fetch HTML (regex supprimées)
supabase/functions/reclassify-sourcing-urls/index.ts  ← simplifié, plus besoin de paramètre use_ai
src/lib/detectPlatform.ts                             ← étend PLATFORMS (mirror : 8 nouveaux noms)
src/pages/Sourcing.tsx                                ← bouton "Reclassifier toutes les URLs (via IA)"
```

Aucune migration SQL.

## Nouvelles plateformes ajoutées à `PLATFORMS`

`omnikles`, `aws`, `eu-supply`, `synapse`, `centrale-marches`, `francemarches`, `aji`, `domino` — vocabulaire enrichi pour Claude.

## Coût OpenRouter estimé

- 130 URLs × ~3 200 tokens entrée + 200 tokens sortie ≈ **~$1.30** pour le run initial (Claude 3.5 Sonnet : ~$3/M in, ~$15/M out).
- Ensuite : 1 appel par nouveau hostname jamais vu. Cache 24 h sur les autres.
- Pour comparaison, Gemini 3 Flash via Lovable AI Gateway serait ~10× moins cher (~$0.13). À toi de choisir : tu as dit OpenRouter + Claude → on part là-dessus, mais c'est un choix conscient.

## Effet attendu

| | Avant | Après |
|---|---|---|
| URLs `custom` | 76 (60 %) | ~5-10 (5-8 %) |
| Plateformes nommées | 11 | 19 |
| URLs avec `pagination_hint` | 0 | ~120 |
| Lignes de code regex à maintenir | ~150 | ~10 (fallback hostname) |
| Complexité du pipeline | 4 niveaux | 2 niveaux |

## Risques et arbitrages

- **Latence** : 1 appel Claude ≈ 2-4 s par URL non cachée. Pour reclassifier 130 URLs en série → ~5-8 min. Acceptable pour un run admin one-shot. Si besoin, parallélisation 5×.
- **Dépendance OpenRouter** : si l'API tombe, plus aucune classification possible (vs avant où le hostname regex tenait le coup). Mitigation : fallback explicite `custom` + log + on garde les valeurs déjà en cache.
- **Hallucination** : risque mitigé par enum fermé + threshold confidence. Si Claude n'est pas sûr → `custom`, pas de mauvaise étiquette.

## Plan d'exécution

1. Créer `aiClassifier.ts` (appel OpenRouter + tool calling).
2. Simplifier `normalize.ts` : nouveau `resolvePlatform()` à 2 niveaux.
3. Élaguer `fingerprint.ts` : ne garder que le fetch HTML brut.
4. Étendre `PLATFORMS` côté front + back.
5. Brancher le bouton "Reclassifier (via IA)" sur `/sourcing` (admin only).
6. Lancer un run one-shot sur les 130 URLs → tu vois le résultat dans `/sourcing`.

