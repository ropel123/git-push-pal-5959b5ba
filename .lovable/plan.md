

# Ajouter le telechargement des fichiers DCE

## Probleme

Les fichiers DCE uploades (manuellement ou automatiquement) s'affichent dans la liste mais ne sont pas cliquables/telechargeables. Il manque une fonction de telechargement.

## Solution

Modifier `DceUploadSection.tsx` pour rendre chaque fichier cliquable avec un lien de telechargement.

## Implementation

**Fichier : `src/components/DceUploadSection.tsx`**

1. Ajouter une fonction `downloadFile` qui utilise `supabase.storage.from("dce-documents").createSignedUrl(filePath, 3600)` pour generer une URL signee temporaire (1h)
2. Ouvrir l'URL dans un nouvel onglet avec `window.open(url, '_blank')`
3. Rendre le nom du fichier cliquable (lien style) et ajouter une icone de telechargement (FileDown) a cote du bouton supprimer
4. Ajouter un indicateur de chargement pendant la generation de l'URL

Le bucket `dce-documents` est probablement prive (pas public), donc les signed URLs sont la bonne approche — elles fonctionnent sans modifier les politiques RLS du bucket.

