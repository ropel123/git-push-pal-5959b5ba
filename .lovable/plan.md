

# Plan : Prochaines étapes du MVP

## Ce qui est déjà fait
- Base de données (8 tables + RLS + trigger)
- Auth (login/signup/logout)
- Layout applicatif (sidebar + header)
- Dashboard (KPIs basiques)
- Liste AO avec recherche + ajout au pipeline
- Pipeline Kanban (colonnes + navigation)
- Avis d'attribution (liste)
- Settings (profil entreprise + préférences)

## Ce qui manque pour compléter le MVP

### 1. Page fiche AO détaillée (`/tenders/:id`)
- Résumé complet : objet, acheteur, montant, dates, CPV, procédure, lots
- Score de pertinence (calcul client basé sur le profil utilisateur)
- Bouton "Ajouter au pipeline"
- Section avis d'attribution lié (si existant)
- Historique des modifications (future V1)

### 2. Onboarding assistant (`/onboarding`)
- Wizard multi-étapes après inscription (si `onboarding_completed === false`)
- Étape 1 : Infos entreprise (nom, SIREN, taille)
- Étape 2 : Secteurs d'activité (sélection multiple)
- Étape 3 : Zones géographiques
- Étape 4 : Mots-clés métier
- Redirect vers `/dashboard` après complétion
- Le `AppLayout` redirige vers `/onboarding` si profil non complété

### 3. Scoring simplifié des AO
- Fonction utilitaire `computeScore(tender, profile)` retournant 0-100
- Critères : correspondance mots-clés (titre/objet), zone géo, secteur CPV
- Affichage badge coloré (vert >70, orange 40-70, rouge <40)
- Affiché dans la liste AO et la fiche détaillée

### 4. Filtres avancés sur la page Tenders
- Filtres : zone géo, montant min/max, type de procédure, statut, date limite
- Sélecteurs dédiés (Select, date picker)
- Sauvegarde de recherche (table `saved_searches`)

### 5. Boutons CTA landing page → `/auth`
- "Se connecter" et "Essai gratuit" dans la navbar
- CTA hero section lié à `/auth`

## Ordre d'implémentation
1. Scoring utilitaire + affichage dans Tenders
2. Fiche AO détaillée `/tenders/:id`
3. Onboarding wizard
4. Filtres avancés + sauvegarde recherche
5. CTA landing → auth

## Fichiers à créer/modifier
- Créer `src/lib/scoring.ts`
- Créer `src/pages/TenderDetail.tsx`
- Créer `src/pages/Onboarding.tsx`
- Modifier `src/pages/Tenders.tsx` (filtres avancés + score)
- Modifier `src/App.tsx` (nouvelles routes)
- Modifier `src/components/AppLayout.tsx` (redirect onboarding)
- Modifier `src/components/Navbar.tsx` (CTA buttons)
- Modifier `src/pages/Index.tsx` ou `HeroSection.tsx` (CTA)

