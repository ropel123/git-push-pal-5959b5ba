

# Plan : Plateforme SaaS de pilotage des appels d'offres publics

## Constat actuel

- Le projet contient uniquement une landing page (Hackify)
- La base Supabase est vide (aucune table)
- Stack : React + Vite + Tailwind + Supabase

## Approche : MVP d'abord

Ce cahier des charges décrit un produit complet qui nécessiterait des mois de développement. Je propose un **découpage MVP / V1 / V2** et de commencer par le MVP.

---

## MVP - Ce que je peux construire maintenant

### 1. Authentification & Onboarding
- Inscription / connexion (email + mot de passe)
- Table `profiles` avec infos entreprise
- Assistant d'onboarding : secteurs, zones géographiques, mots-clés

### 2. Base de données des appels d'offres
Tables Supabase :
- `tenders` : objet, acheteur, montant, dates, CPV, zone geo, type procédure, statut, lots, source
- `tender_documents` : fichiers DCE liés
- `award_notices` : avis d'attribution (titulaire, montant, SIREN, nb candidats)
- `profiles` : utilisateur + préférences
- `user_roles` : gestion des rôles
- `saved_searches` : recherches sauvegardées
- `pipeline_items` : pipeline CRM (statut, assignation, commentaires)
- `alerts` : configuration des alertes

### 3. Pages applicatives
- `/dashboard` : tableau de bord avec KPIs (AO détectés, pipeline, taux Go/NoGo)
- `/tenders` : liste avec recherche avancée et filtres (mots-clés, CPV, zone, montant, dates, acheteur)
- `/tenders/:id` : fiche AO complète (résumé, score, documents, historique, checklist)
- `/pipeline` : vue Kanban (Repéré → En analyse → Go/NoGo → En réponse → Gagné/Perdu)
- `/awards` : liste des avis d'attribution
- `/buyers/:id` : fiche acheteur (historique, fournisseurs récurrents)
- `/settings` : profil, préférences de veille, notifications
- `/auth` : login / signup

### 4. Scoring simplifié
- Score 0-100 basé sur : correspondance mots-clés, zone géo, montant vs taille entreprise
- Affichage vert/orange/rouge
- Logique côté client dans un premier temps (edge function en V1 avec IA)

### 5. Pipeline CRM
- Drag & drop Kanban
- Commentaires internes
- Assignation multi-utilisateurs

---

## Ce qui relève de la V1 / V2 (hors MVP)

| Phase | Fonctionnalités |
|-------|----------------|
| **V1** | Collecte automatique BOAMP/TED via edge functions + cron, scoring IA (Lovable AI), analyse DCE automatique, alertes email, exports Excel/PDF |
| **V2** | Déduplication multi-sources, intelligence concurrentielle, API publique, intégrations CRM, webhooks, qualification humaine |

---

## Détail technique du MVP

### Base de données (migration SQL)

```text
profiles (id, user_id FK auth.users, company_name, siren, sectors[], 
          regions[], keywords[], company_size, created_at)

user_roles (id, user_id FK auth.users, role enum(admin,user,viewer))

tenders (id, reference, title, object, buyer_name, buyer_siret, 
         estimated_amount, cpv_codes[], region, department, 
         procedure_type, publication_date, deadline, source, 
         status, lots jsonb, created_at, updated_at)

award_notices (id, tender_id FK tenders, winner_name, winner_siren, 
               awarded_amount, num_candidates, award_date, 
               contract_duration, created_at)

saved_searches (id, user_id FK auth.users, name, filters jsonb, created_at)

pipeline_items (id, user_id FK auth.users, tender_id FK tenders, 
                stage enum(spotted,analyzing,no_go,responding,won,lost), 
                assigned_to uuid, notes text, score int, created_at, updated_at)

pipeline_comments (id, pipeline_item_id FK pipeline_items, user_id FK auth.users, 
                   content text, created_at)
```

### Routing

```text
/           → Landing page (existante)
/auth       → Login / Signup
/onboarding → Assistant de configuration
/dashboard  → Tableau de bord
/tenders    → Recherche & liste AO
/tenders/:id → Fiche AO détaillée
/pipeline   → Vue Kanban
/awards     → Avis d'attribution
/buyers/:id → Fiche acheteur
/settings   → Paramètres
```

### RLS Policies
- Chaque utilisateur ne voit que ses propres `pipeline_items`, `saved_searches`, `pipeline_comments`
- `tenders` et `award_notices` : lecture pour tous les utilisateurs authentifiés
- `profiles` : lecture/écriture pour son propre profil uniquement

---

## Ordre d'implémentation proposé

1. Migration SQL (toutes les tables + RLS)
2. Auth (login/signup/logout)
3. Layout applicatif (sidebar + header)
4. Dashboard
5. Liste & recherche AO
6. Fiche AO détaillée
7. Pipeline Kanban
8. Avis d'attribution
9. Settings & onboarding

Cela représente un travail conséquent. Je recommande de procéder **étape par étape**, en commençant par les tables + l'authentification.

