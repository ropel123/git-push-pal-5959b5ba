

# Plan : Améliorations UX et fonctionnalités manquantes

## Ce qui est complet
Auth, Onboarding, Dashboard (charts), Tenders (liste + détail + filtres + scoring + sauvegarde recherche), Pipeline (Kanban + commentaires), Awards, BuyerDetail, Settings (alertes), Landing CTA, données de démo.

## Prochaines étapes

### 1. Chargement des recherches sauvegardées
La sauvegarde fonctionne mais il n'y a aucun moyen de **recharger** une recherche sauvegardée. Ajouter un dropdown dans la page Tenders listant les `saved_searches` de l'utilisateur avec possibilité de les appliquer ou supprimer.

### 2. Export CSV des résultats
Bouton "Exporter CSV" sur la page Tenders et sur le Pipeline pour télécharger les données filtrées en fichier CSV (titre, acheteur, montant, région, date limite, statut).

### 3. Pagination sur la liste des AO
Actuellement limitée à 100 résultats. Ajouter une pagination (boutons Précédent/Suivant) avec requêtes paginées côté Supabase via `.range()`.

### 4. Recherches sauvegardées dans le Dashboard
Afficher les recherches sauvegardées de l'utilisateur dans le Dashboard avec un lien rapide pour les exécuter.

### 5. Améliorations UX Pipeline
- Afficher le score de pertinence sur chaque carte du pipeline
- Clic sur le titre d'une carte → navigation vers `/tenders/:id`
- Indicateur visuel de la deadline (rouge si < 3 jours)

## Fichiers à modifier
- `src/pages/Tenders.tsx` — recherches sauvegardées, export CSV, pagination
- `src/pages/Pipeline.tsx` — score, lien vers fiche, deadline indicator, export CSV
- `src/pages/Dashboard.tsx` — section recherches sauvegardées

## Ordre d'implémentation
1. Recherches sauvegardées (chargement + suppression)
2. Export CSV (Tenders + Pipeline)
3. Pagination Tenders
4. Améliorations Pipeline UX
5. Dashboard recherches sauvegardées

