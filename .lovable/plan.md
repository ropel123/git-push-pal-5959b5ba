

## Corriger le favicon dans index.html

Le problème : la balise `<link rel="icon">` est absente du `index.html`. Le fichier `public/favicon.png` existe bien, mais il n'est pas référencé dans le HTML.

### Ce qui sera fait

1. **Ajouter la balise favicon** dans le `<head>` de `index.html` :
   ```html
   <link rel="icon" href="/favicon.png" type="image/png">
   ```

2. **Vérifier** que `public/favicon.png` existe bien (déjà copié précédemment)

### Fichier modifié
- `index.html` — ajout d'une seule ligne dans `<head>`

