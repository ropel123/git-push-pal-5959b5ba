# Pages dédiées vides pour Marchés suivis, Alertes, DCE, Archivés

Les liens de la sidebar pointent actuellement vers `/tenders?view=…`, qui ignore le param et affiche les 19 059 AO. Il faut des pages distinctes avec un état vide propre.

## Nouvelles routes (4 pages)

- `/tracked` — **Marchés suivis** (Briefcase)
- `/alerts` — **Alertes** (Bell)
- `/dce` — **DCE** (FileArchive)
- `/archived` — **Archivés** (FileArchive)

## Composant partagé `EmptyState`

`src/components/EmptyState.tsx` — carte centrée, DA HackAO :
- icône ronde `bg-accent/10 text-accent`
- titre `h1` navy
- description `text-muted-foreground`
- CTA optionnel (button accent)

## Contenu des 4 pages

Toutes utilisent `EmptyState` (aucune donnée fetchée pour l'instant) :

| Page | Titre | Description | CTA |
|---|---|---|---|
| Marchés suivis | "Aucun marché suivi" | "Suivez un appel d'offres depuis la recherche pour le retrouver ici." | "Explorer les AO" → `/tenders` |
| Alertes | "Aucune alerte active" | "Créez une alerte pour être notifié des nouveaux AO correspondant à vos critères." | "Créer une alerte" → `/settings` |
| DCE | "Aucun DCE téléchargé" | "Les dossiers de consultation que vous récupérez apparaîtront ici." | "Voir les AO" → `/tenders` |
| Archivés | "Aucun marché archivé" | "Les AO que vous archivez apparaîtront ici pour référence." | (pas de CTA) |

## Sidebar — mise à jour des liens

`src/components/AppSidebar.tsx` :
- Marchés suivis → `/tracked`
- Alertes → `/alerts`
- DCE → `/dce`
- Archivés → `/archived`

## Routes

`src/App.tsx` — ajouter 4 routes dans le bloc `AppLayout` :
```tsx
<Route path="/tracked" element={<TrackedTenders />} />
<Route path="/alerts" element={<AlertsPage />} />
<Route path="/dce" element={<DcePage />} />
<Route path="/archived" element={<ArchivedTenders />} />
```

## Fichiers

**Créés** :
- `src/components/EmptyState.tsx`
- `src/pages/TrackedTenders.tsx`
- `src/pages/AlertsPage.tsx`
- `src/pages/DcePage.tsx`
- `src/pages/ArchivedTenders.tsx`

**Modifiés** :
- `src/App.tsx` (4 imports + 4 routes)
- `src/components/AppSidebar.tsx` (4 URLs)
- `src/components/AppLayout.tsx` (ajout des titres de page pour les 4 nouvelles routes)

Aucun changement de schéma, de hook, ou de logique métier. Pure structure de navigation + UI vide.

## Hors scope

- Pas de Mémoires/Chiffrages/Mots-clés/Profils (déjà sur `?view=` — à traiter séparément si besoin).
- Pas de logique de filtrage (la table `tenders` n'a pas de colonne `tracked`/`archived` ni de relation user — c'est un futur travail data).
- Pas de branchement réel des alertes (le hook `useAlerts` existe, on l'utilisera dans une itération suivante).
