

# Import en masse robuste — page Sourcing

## Problèmes observés sur ta capture

1. **Lignes non-URL acceptées** : `Recherche avancée - Portail des marchés publics`, `Nos consultations | Aéroport…` passent dans le textarea et font planter l'insert.
2. **Doublons internes** : la même URL collée 2 fois dans le textarea → la 1re passe, la 2e remonte `duplicate key value violates unique constraint "sourcing_urls_url_key"` et **stoppe tout l'import** (rien d'autre n'est inséré après l'erreur).
3. **Aucun feedback ligne par ligne** : un seul toast d'erreur générique, impossible de savoir laquelle a échoué ni ce qui est passé.

## Solution — pipeline de parsing + insertion tolérante

### 1. Parsing strict côté front (avant tout appel réseau)

Pour chaque ligne du textarea :
- `trim()` + ignorer lignes vides.
- Tester que ça commence par `http://` ou `https://`.
- Tenter `new URL(line)` → si throw, ligne rejetée.
- Normaliser : retirer trailing slash, lowercase hostname.

→ Construire 3 listes : `valid[]`, `invalid[]` (avec raison), `duplicatesInPaste[]` (URLs présentes 2× dans le textarea).

### 2. Dédoublonnage contre la base

Avant insert : `select url from sourcing_urls where url in (...)` → écarter celles déjà présentes, les ranger dans `alreadyExists[]`.

### 3. Insert ligne par ligne (pas en batch)

Boucle `for (const url of valid)` avec `insert().select()` individuel. Chaque échec est attrapé localement et n'arrête PAS la boucle. On compte `inserted`, `failed[]`.

### 4. Récap final dans une Dialog (pas un toast)

À la fin, ouvrir une Dialog "Résultat de l'import" avec 4 sections pliables :

```text
✓ 12 URLs importées
⚠ 3 URLs déjà présentes (skippées)
⚠ 2 doublons dans votre liste (1re version gardée)
✗ 4 lignes invalides :
  - "Recherche avancée - Portail des marchés publics" (pas une URL)
  - "Nos consultations | Aéroport…" (pas une URL)
```

Bouton "Copier les lignes invalides" pour les récupérer et les corriger.

### 5. Auto-détection plateforme conservée

Pour chaque URL valide insérée : `platform = detectPlatform(url)` (déjà fait actuellement, on garde).

## Fichier concerné

```text
src/pages/Sourcing.tsx   ← refactor de handleBulkImport()
```

Aucune migration SQL, aucune edge function. ~60 lignes ajoutées.

## Effet attendu

- Tu peux coller n'importe quel mix d'URLs + texte sans casser l'import.
- Les doublons sont signalés clairement, pas bloquants.
- Tu vois exactement ce qui est passé / ce qui a été refusé / pourquoi.

