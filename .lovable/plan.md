

# Détection plateforme robuste + reclassement BDD

## Constat

Sur `/sourcing`, l'URL `https://marchespublics.auvergnerhonealpes.eu/sdm/...` est étiquetée **"safetender"**. C'est faux : ce domaine tourne sur **LocalTrust/Atexo SDM** (signature `/sdm/ent2/gen/...action`). SafeTender est un autre éditeur.

Cause : la détection actuelle (`hostname.includes(...)`) est trop laxiste — n'importe quel host avec `/sdm/` dans le path tombait sur la branche `safetender` à cause de l'ordre des règles dans `_shared/normalize.ts`.

## Plan d'action

### Étape 1 — Classifier centralisé robuste

Refonte de `detectPlatformFromUrl()` dans `supabase/functions/_shared/normalize.ts` avec une **table de signatures ordonnée par spécificité** (host exact > host suffix > path pattern), et **SafeTender uniquement si "safetender" littéralement dans le hostname**.

Règles, dans l'ordre :

```text
1.  hostname === marchespublics.auvergnerhonealpes.eu          → aura
2.  hostname endsWith maximilien.fr                            → maximilien
3.  hostname endsWith megalis.bretagne.bzh                     → megalis
4.  hostname endsWith ternum-bfc.fr                            → ternum
5.  hostname endsWith alsacemarchespublics.eu                  → atexo (Alsace)
6.  hostname endsWith ampmetropole.fr / nantesmetropole.fr / 
    paysdelaloire.fr / grand-nancy.org / grandlyon.com / 
    aquitaine.fr / lorraine.eu / demat-ampa.fr                 → atexo
7.  hostname contient "atexo"                                  → atexo
8.  hostname endsWith marches-publics.info                     → mpi
9.  hostname endsWith marchespublics.grandest.fr               → mpi
10. hostname endsWith projets-achats.marches-publics.gouv.fr   → place
11. hostname === marches-publics.gouv.fr / www.marches-publics.gouv.fr → place
12. hostname endsWith achatpublic.com                          → achatpublic
13. hostname endsWith e-marchespublics.com                     → e-marchespublics
14. hostname endsWith marches-securises.fr                     → marches-securises
15. hostname endsWith klekoon.com                              → klekoon
16. hostname endsWith xmarches.fr                              → xmarches
17. hostname contient "safetender"                             → safetender   ← STRICT
18. path contient "/sdm/ent2/gen/"                             → atexo        ← fallback SDM
19. path contient "/sdm/"                                      → atexo
20. sinon                                                      → custom
```

Différences clés :
- `endsWith` au lieu de `includes` → empêche les faux positifs (ex. un host contenant "place" par hasard).
- SafeTender ne tombe plus sur les SDM régionaux.
- Les SDM (`/sdm/...`) sont par défaut **atexo**, pas safetender.
- Ajout d'un mapping explicite `aura` pour Auvergne-Rhône-Alpes.

### Étape 2 — Reclassement des données existantes

Migration SQL ciblée sur `sourcing_urls` ET `tenders.source` :

- `sourcing_urls` : recalcule `platform` selon les nouvelles règles via `CASE … END` SQL équivalent aux signatures ci-dessus.
- `tenders` : remplace `source` quand mal étiqueté (ex. `scrape:safetender` pour une URL AURA → `scrape:aura`).
- `scrape_logs` : idem pour cohérence reporting.

### Étape 3 — Front aligné

Dans `src/pages/Sourcing.tsx` :

- Remplacer la fonction locale `detectPlatform()` par un import partagé qui réplique la logique du back (créer `src/lib/detectPlatform.ts` avec exactement les mêmes signatures).
- Étendre la liste `PLATFORMS` dans le `Select` avec : `aura`, `maximilien`, `megalis`, `ternum`.
- Afficher la plateforme avec un badge plus lisible (déjà en place).

### Étape 4 — Garde-fou ingestion

Dans `supabase/functions/scrape-list/index.ts` et tout endroit qui set un `source` ou `platform` :

- Toujours passer par `detectPlatformFromUrl(url)` plutôt que faire confiance à une valeur héritée.
- Si retour `custom`, log warning explicite avec le hostname pour qu'on enrichisse la table de signatures.

## Fichiers concernés

```text
supabase/functions/_shared/normalize.ts          ← classifier robuste
supabase/functions/scrape-list/index.ts          ← passe toujours par classifier
src/lib/detectPlatform.ts                        ← nouveau (miroir front)
src/pages/Sourcing.tsx                           ← utilise lib + PLATFORMS étendu
supabase/migrations/<ts>_reclassify_platforms.sql ← reclasse sourcing_urls + tenders + scrape_logs
```

## Effet attendu

- L'URL Auvergne-Rhône-Alpes affiche **"aura"** (et plus jamais "safetender").
- Toutes les SDM régionales (Maximilien, Ternum, Megalis, AURA, Alsace, AMP, etc.) tombent en **atexo** ou leur label régional dédié.
- SafeTender réservé aux vrais hosts SafeTender.
- Front et back partagent exactement la même logique → impossible de diverger.
- Les lignes déjà en BDD sont reclassées en une seule migration.

