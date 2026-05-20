## Symptôme

Après le téléchargement (qui fonctionne désormais grâce au correctif RLS), macOS refuse d'ouvrir le ZIP : *"Le fichier n'a pas un format correct"*.

## Indices

- Les deux ZIPs `agent_*.zip` du tender courant font **exactement 20 476 024 octets** (taille identique pour deux runs différents et tenders différents). Très suspect.
- Côté code (`supabase/functions/fetch-dce-agent/index.ts` lignes 63-70), on uploade tel quel le corps de `GET https://api.browserbase.com/v1/sessions/{id}/downloads` dès qu'il dépasse 100 octets, **sans valider que c'est bien un ZIP**.

## Hypothèses les plus probables (par ordre)

1. **Le corps n'est pas un ZIP.** Browserbase peut renvoyer une page HTML (auth/erreur), un JSON d'erreur ou un index multipart quand la session n'a aucun download. Les 100 octets de garde ne protègent pas.
2. **Archive Browserbase corrompue/tronquée** (timeout côté Browserbase, déconnexion HTTP/2). Le corps fait 20 MB mais ne se termine pas par un EOCD ZIP valide.
3. **Erreur de double-encoding** (le `Uint8Array` survit bien dans `supabase.storage.upload`, mais à vérifier en relisant les 4 premiers octets via une fonction de debug).

## Correctif proposé

### 1. Valider le ZIP avant upload (`fetch-dce-agent/index.ts`)

Dans `downloadSessionArchive`, après `arrayBuffer()` :
- vérifier la magic header `PK\x03\x04` sur les 4 premiers octets,
- vérifier la présence de la signature EOCD (`PK\x05\x06`) dans les 64 KB de queue,
- sinon : log `archive.invalid` avec head/tail hex + content-type Browserbase, et renvoyer `null` (pas d'upload, pas de ligne `dce_uploads`).

### 2. Logger le `content-type` et la taille reçus de Browserbase

Ajouter dans le trace l'en-tête `content-type` et `content-length` retournés par Browserbase pour savoir si l'API a réellement renvoyé un ZIP ou autre chose.

### 3. Edge function de diagnostic (one-shot) : `inspect-dce-zip`

Petite fonction admin qui prend un `file_path` et renvoie :
- les 32 premiers octets en hex,
- les 32 derniers octets en hex,
- la taille,
- le résultat d'un test `unzip -t` (via WebAssembly `fflate` côté Deno : `unzipSync` détecte tout de suite un ZIP cassé).

Cela permet de confirmer en direct si les ZIPs déjà en base sont vraiment cassés (hypothèse 1/2) ou si c'est macOS qui interprète mal un ZIP valide (hypothèse 3, improbable).

### 4. Supprimer les ZIPs invalides existants

Après diagnostic, purger les lignes `dce_uploads` + objets storage correspondants pour ne plus exposer de fichiers cassés à l'utilisateur.

## Hors-scope (à valider plus tard)

- Si Browserbase renvoie souvent un ZIP vide/cassé, fallback : récupérer les fichiers individuellement via `GET /v1/sessions/{id}/downloads/{filename}` puis re-zipper côté edge avec `fflate.zipSync`.
- Dédupliquer l'affichage des ZIPs dans la fiche tender (deux entrées identiques visibles aujourd'hui).