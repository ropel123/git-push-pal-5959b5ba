
# Plan pré-launch HackAO

Roadmap découpée en 5 phases livrables indépendamment. Chaque phase = un message de build distinct pour rester pilotable.

---

## Phase 1 — Quick wins Accueil + Recherche + Mes affaires

### Accueil (`src/pages/Dashboard.tsx`)
- Supprimer le bloc **Calendrier** (colonne gauche du dernier grid) et le remplacer par un **Pipe Kanban condensé** (réutilisation de `usePipelineDistribution` + lien vers `/pipeline`). Affichage : une colonne compacte par étape (Repéré, En analyse, En réponse, Gagné, Perdu) avec compteurs + 2-3 dernières opportunités.
- Supprimer la carte **Mes profils** (savedSearches).
- Garder Alertes + Favoris + Actualité.

### Recherche (`src/pages/Tenders.tsx`)
- Sidebar filtres **sticky** (`sticky top-0 h-screen overflow-y-auto`) au lieu de scroll commun.
- **Badge plateformes** : ajouter un petit panneau « Sources actives » en haut des filtres, alimenté par `sourcing_urls` (group by `platform` + dernier `last_status`). Vert = success récent, ambre = stale > 48h, rouge = error.
- Supprimer l'option **« Toutes les procédures »** dans le filtre procédure (laisser multi-select propre).
- Supprimer le filtre **« Plateforme »** (devient redondant avec le panneau statut).
- **Nettoyer** la liste de procédures : whitelister (Appel d'offres ouvert, Appel d'offres restreint, Procédure adaptée (MAPA), Dialogue compétitif, Procédure négociée, Concours, Marché de gré à gré, Accord-cadre).
- **Pré-sélectionner** « Appel d'offres ouvert » par défaut au premier chargement (persisté dans URL params).
- Fix **« Mots clés ne marche pas »** : auditer `useTenders` (probable problème d'`ilike` côté Supabase ou de debounce), corriger.
- Fix **« Profils de veille ne marche pas »** : auditer `useSavedSearches` + bouton « appliquer ».

### Mes affaires (`src/pages/Pipeline.tsx`)
- Renommer la page et l'item sidebar : **« Mes appels d'offres »**.
- Activer **drag-and-drop horizontal** entre colonnes Kanban (déjà cliquable via flèches actuellement) — utiliser `@dnd-kit/core` déjà installé si dispo, sinon l'ajouter.
- Supprimer la sous-section/onglet **Chiffrage** et la route `/pricing` (ou la cacher).

---

## Phase 2 — Refonte TenderDetail (`src/pages/TenderDetail.tsx`)

- Onglet **Informations générales** : ajouter bouton **« Suivre cet acheteur »** (insert dans une nouvelle table `buyer_follows` → migration légère, RLS user_id).
- Supprimer le bloc **« Origine du scrapping »**.
- Supprimer le bouton **« Récupérer le DCE automatiquement »** (manuel).
- **Renommer** la description du bouton « Récupération automatique par agent IA » (texte plus clair, type « Notre agent IA télécharge, dézippe et analyse les pièces du DCE en arrière-plan »).
- **Fusionner** les blocs « Documents de consultation » et « Analyse IA » en un seul panneau avec onglets internes (DCE / Analyse).
- Ajouter en bas un CTA **« Besoin d'aide pour répondre à cet AO ? Prenez rendez-vous avec un chef de projet »** → lien Calendly (URL à fournir, sinon mailto temporaire).

---

## Phase 3 — Attributions (`src/pages/Awards.tsx`)

Page actuellement minimale. Construire :
- Liste paginée des `award_notices` (table existante, peuplée par `scrape-awards-list`).
- Filtres : acheteur, date d'attribution, fourchette montant, secteur.
- Détail latéral : titulaire, montant, durée, lien vers le tender lié si match.
- Stat header : nb attributions du mois, total montants, top 5 acheteurs.

---

## Phase 4 — Paiement Stripe BYOK + grilles de prix

Choix utilisateur : **BYOK** (la clé Stripe sera fournie via `STRIPE_SECRET_KEY` secret).

### Setup
- Demander la clé via `add_secret` (STRIPE_SECRET_KEY).
- Edge functions :
  - `create-checkout` : crée une session Stripe Checkout (mode subscription ou payment selon plan).
  - `stripe-webhook` : reçoit events, met à jour table `subscriptions`.
  - `customer-portal` : ouvre le portail Stripe pour gérer abonnement.
- Migration : table `subscriptions` (user_id, plan, status, current_period_end, stripe_customer_id, stripe_subscription_id) + RLS user-scoped + grants standards.

### Grilles à exposer dans la landing + page `/billing`
**Sourcing**
- 99 € HT / mois — alertes illimitées + accès plateforme
- +20 € HT / mois par adresse e-mail supplémentaire

**Assistant IA**
- Starter — 99 € / mois — 1 AO analysé
- Pro — 250 € / mois — 3 AO
- Business — 450 € / mois — 10 AO

**Chef de projet AO (offre hybride, pas auto-checkout)**
- Marchés < 1 M€ : 500 € HT fixe + 1 % du marché gagné
- Marchés > 1 M€ : 2 000 € HT fixe + 0,5 % du marché gagné
- Bouton « Demander un devis » → formulaire / Calendly (pas de Stripe).

---

## Phase 5 — Landing publique (refonte complète `src/pages/Index.tsx`)

Refonte complète avec sections :
1. Hero (HackAO, value prop « L'IA qui répond aux appels d'offres publics à votre place »)
2. Problèmes (perte de temps, dispersion des sources, mémoire technique éparpillée)
3. Solution (3 piliers : Veille, Analyse IA, Réponse assistée)
4. Démo visuelle / before-after
5. Plateformes scrapées (logos / liste)
6. Pricing (3 grilles du Phase 4)
7. Témoignages / trust
8. FAQ
9. CTA final + footer

**Style** : crème + navy + accent bleu (charte mémoire), gradient bleu→jaune réservé hero + CTA premium. Polices existantes.

Pour la refonte hero/sections visuelles, je passerai par **design directions** (3 propositions rendues) avant d'implémenter.

---

## Phase 6 — Idée différée (non incluse maintenant)

- **API vers Salesforce** : à scoper séparément (auth OAuth Salesforce, mapping objets, sync push/pull). À planifier après lancement.

---

## Migrations DB nécessaires

1. `buyer_follows (user_id, buyer_id, created_at)` — Phase 2
2. `subscriptions (user_id, plan, status, …)` — Phase 4

Toutes avec RLS user-scoped + GRANTs standard.

---

## Ordre de livraison recommandé

1. Phase 1 (impact UX immédiat, pas de backend)
2. Phase 2 (TenderDetail, migration légère)
3. Phase 5 design directions (en parallèle pendant que tu valides Phase 1/2)
4. Phase 3 (Awards) — dépend de `scrape-awards-list` qui peuple déjà la table
5. Phase 4 (Stripe BYOK) — nécessite ta clé
6. Phase 5 implémentation landing

Dis-moi par quelle phase tu veux que je commence en build, ou si tu veux d'abord ajuster le périmètre.
