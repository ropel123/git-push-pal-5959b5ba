# Filtres sur la table "URLs configurées"

Ajouter une barre de filtres juste au-dessus du tableau (carte "URLs configurées (120)") pour permettre de chercher / trier les 120 lignes facilement.

## Filtres proposés

1. **Recherche texte** (input) — filtre instantané sur `url` + `display_name` (insensible à la casse)
2. **Plateforme** (Select) — `Toutes` + une option par plateforme effectivement présente dans la liste, triées par fréquence (ex : `atexo (42)`, `xmarches (18)`, `custom (15)`…)
3. **Statut du dernier run** (Select) — `Tous` / `success` / `error` / `jamais lancé`
4. **Actif** (Select) — `Tous` / `Actifs` / `Inactifs`

Bouton **Réinitialiser** pour vider tous les filtres en un clic.

## Comportement

- Filtrage 100 % côté client (les 120 URLs sont déjà chargées en mémoire), pas de requête supplémentaire.
- Le compteur du titre passe de `URLs configurées (120)` à `URLs configurées (37 / 120)` quand un filtre est actif, pour que tu voies tout de suite combien de lignes sont masquées.
- Si aucun résultat → message "Aucune URL ne correspond aux filtres" dans le tbody.
- Les filtres restent actifs après un `reclassifyOne` / `runNow` / reload (state local React, pas écrasé par `load()`).

## Détails techniques

- Tout se passe dans `src/pages/Sourcing.tsx`, aucun changement DB, aucune edge function touchée.
- 4 nouveaux `useState` : `searchQuery`, `platformFilter`, `statusFilter`, `activeFilter`.
- `useMemo` qui dérive `filteredUrls` depuis `urls` + les 4 filtres.
- `useMemo` qui dérive la liste des plateformes disponibles avec leur compte, à partir de `urls`.
- La barre de filtres est insérée juste au-dessus de `<Table>` dans le `<CardContent>` du Card "URLs configurées" (ligne ~623), en utilisant les composants existants `Input` et `Select` (shadcn) pour rester cohérent visuellement.
- Layout : `flex flex-wrap gap-2 mb-4`, avec `Input` qui prend `flex-1 min-w-[240px]` et les 3 selects en largeur fixe (~`w-[180px]`).

## Ce qui ne change pas

- Le panneau "Re-classifier / Provider IA" en haut reste tel quel.
- La table `Logs récents` en bas n'est pas filtrée (hors scope, dis-moi si tu veux la même chose dessus).
- Aucune persistance des filtres (pas d'URL params, pas de localStorage) — on peut l'ajouter plus tard si besoin.
