

## Mettre à jour le favicon avec le nouveau logo

### Ce qui change
Remplacement du favicon actuel par la nouvelle image uploadée (le logo Hackify avec la flèche orange).

### Etapes
1. **Copier l'image** `user-uploads://Capture_d_écran_2026-04-09_à_16.12.57.png` vers `public/favicon.png` (écrase l'existant)
2. **Vérifier** que `index.html` contient déjà `<link rel="icon" href="/favicon.png" type="image/png">` (ajouté précédemment)

### Détail technique
- Le fichier `public/favicon.png` sera remplacé par la nouvelle image
- Aucune modification de `index.html` ne devrait être nécessaire car le lien favicon est déjà en place

