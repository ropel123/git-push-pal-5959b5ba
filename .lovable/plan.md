

# Pièces jointes dans le chat mémoire IA

## Résumé

Ajouter un bouton d'upload de fichiers (PDF, images, DOCX) dans le chat mémoire pour que l'utilisateur puisse envoyer des certificats, attestations, organigrammes, etc. Les fichiers sont stockés dans Supabase Storage, et leur contenu extrait est envoyé à l'IA comme contexte dans la conversation.

## Changements

### 1. Bucket Storage (migration SQL)

Utiliser le bucket existant `company-assets` pour stocker les pièces jointes du chat mémoire dans un sous-dossier `memoir-attachments/{user_id}/`.

### 2. UI - Bouton d'upload dans `MemoirAIChat.tsx`

- Ajouter un `<input type="file" hidden>` acceptant `.pdf,.jpg,.png,.docx,.xlsx`
- Ajouter un bouton trombone (icone `Paperclip`) à gauche du champ de saisie
- Afficher les fichiers sélectionnés sous forme de chips avec nom + icone de suppression
- Quand l'utilisateur envoie un message avec des fichiers :
  1. Upload chaque fichier vers `company-assets/memoir-attachments/{user_id}/{timestamp}_{filename}`
  2. Envoyer au backend les URLs des fichiers + le message texte
- Afficher les pièces jointes dans les bulles de message utilisateur (nom du fichier avec icone)

### 3. Edge Function - Traitement des fichiers dans `generate-memoir/index.ts`

- Accepter un nouveau champ `attachments` dans le body : `{ name: string, url: string, type: string }[]`
- Pour chaque fichier joint, ajouter au message utilisateur un bloc texte indiquant :
  `[Pièce jointe : {nom_fichier}]`
- Le contenu des fichiers n'est pas extrait par l'IA (pas de vision/OCR côté LLM) mais l'IA sait qu'un document a été fourni et peut poser des questions dessus
- Stocker les métadonnées des fichiers joints dans le profil via un nouveau champ ou dans les references

### 4. Type Message enrichi

- Étendre le type `Message` pour inclure un champ optionnel `attachments?: { name: string, url: string }[]`
- Afficher les pièces jointes dans les bulles du chat

## Détails techniques

- Bucket `company-assets` existe déjà avec RLS configuré
- Les fichiers sont uploadés via `supabase.storage.from('company-assets').upload()`
- URL signée générée via `createSignedUrl()` pour le téléchargement
- Taille max par fichier : 10 MB (validation côté client)
- Types acceptés : PDF, JPG, PNG, DOCX, XLSX
- Pas de parsing OCR des fichiers par le LLM - l'IA voit juste les noms et peut demander à l'utilisateur de décrire le contenu

