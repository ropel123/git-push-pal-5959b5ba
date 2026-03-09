

# Plan : Prochaines fonctionnalités

## Ce qui est fait
- Auth, Onboarding, Dashboard, Tenders (liste + détail + filtres + scoring), Pipeline (Kanban), Awards, Settings, Landing CTA

## Ce qui manque encore dans le MVP

### 1. Données de démonstration
Insérer 15-20 appels d'offres fictifs + 5 avis d'attribution via migration SQL pour que l'app ne soit pas vide au premier lancement. Couvre différentes régions, secteurs, montants et statuts.

### 2. Page Fiche Acheteur (`/buyers/:id`)
- Route `/buyers/:id` (identifié par `buyer_name` ou `buyer_siret`)
- Historique des AO publiés par cet acheteur
- Avis d'attribution liés (fournisseurs récurrents)
- Montants moyens, nombre d'AO
- Lien cliquable depuis la fiche AO et la liste

### 3. Dashboard enrichi
- Graphique recharts : AO par mois (bar chart)
- Répartition pipeline par étape (pie/donut chart)
- Liste des 5 derniers AO ajoutés au pipeline
- Alertes : AO avec deadline proche (< 7 jours)

### 4. Commentaires sur le pipeline
- Formulaire d'ajout de commentaire sur chaque pipeline item
- Liste des commentaires dans un drawer/dialog
- Utilise la table `pipeline_comments` déjà existante

### 5. Notifications / Alertes configurables
- Page ou section dans Settings pour gérer les alertes
- Utilise la table `alerts` existante (name, filters, frequency, enabled)
- Affichage dans le dashboard des AO matchant les alertes actives

## Fichiers à créer/modifier
- Migration SQL : données de démonstration
- Créer `src/pages/BuyerDetail.tsx`
- Modifier `src/App.tsx` (route `/buyers/:id`)
- Modifier `src/pages/Dashboard.tsx` (charts + activité récente)
- Modifier `src/pages/Pipeline.tsx` (commentaires)
- Modifier `src/pages/TenderDetail.tsx` (lien acheteur)
- Modifier `src/pages/SettingsPage.tsx` (section alertes)
- Modifier `src/components/AppSidebar.tsx` (lien si besoin)

## Ordre d'implémentation
1. Données de démo (migration SQL)
2. Dashboard enrichi (charts recharts)
3. Page fiche acheteur
4. Commentaires pipeline
5. Gestion des alertes

