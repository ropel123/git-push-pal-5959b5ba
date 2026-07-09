## Problème

Le symbole du logo dans la sidebar apparaît cassé : les 4 « pétales » du path SVG ne forment pas un vrai moulinet équilibré. Le path actuel dessine des rectangles avec un coin arrondi + une courbe interne, ce qui produit des formes irrégulières et mal alignées au centre.

## Correction

Refaire uniquement le symbole dans `src/components/brand/HackaoLogo.tsx` — ne pas toucher au wordmark, à la sidebar, ou au reste du layout.

Nouvelle géométrie du pinwheel :
- 4 pétales identiques disposées à 0°, 90°, 180°, 270° autour du centre
- Chaque pétale = quart de disque (rayon extérieur ~22) avec un coin interne carré et un coin externe arrondi, laissant un petit vide au centre (~4px) pour l'effet moulinet
- Path unique propre basé sur `M` + arc `A` + lignes droites, sans mélange rect/arc bricolé
- Épaisseur régulière, angles nets, symétrie parfaite après rotation

Le gradient (`hackao-gradient`) et l'API du composant (`variant`, `tone`, `size`, `className`) restent inchangés — donc aucun autre fichier ne bouge (AppSidebar, Navbar, etc. continuent de marcher).

## Fichier modifié

- `src/components/brand/HackaoLogo.tsx` — remplacer la fonction `Petal` et son path par une géométrie de moulinet correcte.
