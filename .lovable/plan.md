

# Afficher l'URL complète dans la table Sourcing

## Constat

Sur `/sourcing`, la colonne "URL" affiche `display_name` si présent, sinon l'URL tronquée (`max-w-[280px] truncate`). Du coup on voit "Haute-Garonne", "Région Grand Est", "APProch — Préavis (État)" mais jamais l'URL réelle qu'on peut copier/vérifier.

## Changement

Dans `src/pages/Sourcing.tsx`, remplacer la cellule URL par :

- **Ligne 1** : `display_name` en gras si présent, sinon rien.
- **Ligne 2** : l'URL complète, cliquable (`<a href target="_blank">`), en `text-xs text-muted-foreground`, avec `break-all` pour gérer le retour à la ligne sans casser la mise en page.
- Retirer `truncate` et `max-w-[280px]` sur la cellule.
- Élargir la colonne (ex. `min-w-[360px]`) pour donner de la place sans déformer les autres colonnes.

## Fichier modifié

```text
src/pages/Sourcing.tsx   ← cellule URL : nom + URL complète cliquable
```

## Effet attendu

Chaque ligne montre clairement le nom court ET l'URL complète scrappée, avec ouverture en nouvel onglet pour vérifier rapidement la cible.

