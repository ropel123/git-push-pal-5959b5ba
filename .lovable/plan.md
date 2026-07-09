## Ce que tu veux

Le logo de la **photo 1** partout dans l'app (sidebar dashboard, navbar landing, footer, favicon, etc.) :
- Symbole : carré à coins très arrondis, rempli d'un **dégradé bleu → violet**, avec un petit **carré blanc arrondi centré** (effet "bouton app iOS"), et une ombre douce diffuse derrière.
- Wordmark : **Hack** en navy + **AO** en bleu vif, gras, à droite du symbole.

## Ce que je vais faire

Refaire uniquement `src/components/brand/HackaoLogo.tsx` — l'API du composant (`variant`, `tone`, `size`, `className`) reste identique, donc **aucun autre fichier ne change** et le nouveau logo apparaît automatiquement partout où `<HackaoLogo />` est utilisé : sidebar (`AppSidebar`), navbar landing (`Navbar`), footer, page auth, onboarding, etc.

Détails du nouveau symbole :
- SVG carré, ratio 1:1, `rx` ~28% pour les coins très arrondis (style squircle iOS)
- Dégradé linéaire diagonal : `#3B5BFF` (bleu) → `#6D3BFF` (violet), défini dans `<defs>`
- Carré blanc intérieur centré, ~40% de la taille, `rx` ~25%
- Ombre douce : `<filter>` SVG avec `feGaussianBlur` teintée bleu/violet à faible opacité, débordant légèrement du viewBox
- `tone="white"` et `tone="currentColor"` conservés (variantes plates sans dégradé) pour les fonds sombres

Wordmark : inchangé dans sa structure (`Hack` primary + `AO` accent), juste garder la cohérence de graisse et de taille avec la photo 1.

### Favicon

Le favicon actuel (`public/favicon.png` + `<link>` dans `index.html`) est déjà basé sur l'ancien symbole. Je le régénère à partir du nouveau symbole (export PNG 512×512) et je remplace `public/favicon.png` — pas de changement dans `index.html`.

## Fichiers touchés

- `src/components/brand/HackaoLogo.tsx` — nouveau symbole squircle + gradient + carré blanc + shadow
- `public/favicon.png` — régénéré depuis le nouveau symbole

Aucun autre fichier n'a besoin d'être modifié : tous les usages passent déjà par `<HackaoLogo />`.
