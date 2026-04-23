

# Repère stable sur la ligne en cours d'édition (page Sourcing)

## Problème

Quand tu modifies une URL, après "Enregistrer" la liste recharge et tu perds visuellement la ligne sur laquelle tu travaillais. Pas de scroll-to, pas de highlight, et si l'URL a changé tu ne sais plus laquelle c'était.

## Solution — 3 ancrages

### 1. ID stable sur chaque `<TableRow>`

Chaque ligne reçoit un `id={`row-${u.id}`}` et un `data-row-id={u.id}`. Permet le scroll-to programmatique et le ciblage CSS sans dépendre de l'ordre.

### 2. Highlight de la ligne juste éditée (3s)

- Nouvel état `highlightedId: string | null`.
- À la fin de `saveEdit()` (succès) → `setHighlightedId(editing.id)` AVANT `load()`.
- Sur la ligne correspondante : classe conditionnelle `bg-primary/10 ring-1 ring-primary/40 transition-colors duration-500`.
- `setTimeout(() => setHighlightedId(null), 3000)` pour retirer le highlight.

### 3. Auto-scroll vers la ligne éditée

Après `load()`, dans un `useEffect([highlightedId, urls])` :
```
document.getElementById(`row-${highlightedId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
```

Garantit que même si la ligne était hors viewport (table longue), elle revient au centre.

## Bonus stabilité — pendant l'édition

Dans le header du Dialog, afficher en sous-titre l'ancienne URL et l'ID court :

```
Modifier l'URL de sourcing
ancien : https://… · #a1b2c3d4
```

Comme ça même si tu changes l'URL en cours de saisie, tu sais toujours quelle ligne tu modifies. Utilise `editing.url` (snapshot pris à `openEdit`) qui ne bouge pas tant que le dialog est ouvert.

## Garde-fou anti race-condition

- Désactiver le bouton "Enregistrer" pendant la sauvegarde (`saving` state) pour empêcher un double-clic qui ouvrirait deux updates.
- Bloquer la fermeture accidentelle du dialog (`onOpenChange`) pendant `saving`.

## Fichier concerné

```text
src/pages/Sourcing.tsx
```

Aucune migration, aucun changement edge function. Pur front, ~30 lignes ajoutées.

## Effet attendu

Après "Enregistrer" : la liste recharge → la ligne éditée est mise en surbrillance orange douce pendant 3s et défile au centre de l'écran. Plus aucun risque de "perdre" la ligne sur laquelle tu travaillais, même si tu enchaînes 10 modifications.

