

# Plan : Scraping des AO — Phase 1 MVP

## Approche

Architecture hybride en 2 temps, comme tu l'as décrit. Phase 1 : Edge Functions pour BOAMP + TED (APIs ouvertes, parsing déterministe). Firecrawl pour les profils acheteurs sera Phase 2.

## Ce qui sera implémenté

### 1. Migration DB : préparation déduplication + logs
- Index unique `(reference, source)` sur `tenders` pour upsert
- Colonne `source_url` sur `tenders`
- Table `scrape_logs` (id, source, started_at, finished_at, items_found, items_inserted, errors, status)
- RLS : lecture admin uniquement sur `scrape_logs`

### 2. Edge Function `scrape-boamp`
- Appel API BOAMP open data (`https://api.boamp.fr/`)
- Récupération incrémentale (dernières 24h)
- Parsing et normalisation vers le schéma `tenders`
- Upsert avec `ON CONFLICT (reference, source) DO UPDATE`
- Log dans `scrape_logs`
- Rattachement automatique des avis d'attribution dans `award_notices`

### 3. Edge Function `scrape-ted`
- Appel API TED (`https://api.ted.europa.eu/`)
- Même logique : fetch incrémental, normalisation, upsert, log

### 4. Scheduling pg_cron
- Exécution SQL via insert tool (pas migration) pour créer les jobs `pg_cron`
- `scrape-boamp` : tous les jours à 2h
- `scrape-ted` : tous les jours à 3h

### 5. Config
- `supabase/config.toml` : déclarer les 2 fonctions avec `verify_jwt = false`

## Fichiers à créer/modifier
- Migration SQL : index unique, colonne `source_url`, table `scrape_logs`
- `supabase/functions/scrape-boamp/index.ts`
- `supabase/functions/scrape-ted/index.ts`
- `supabase/config.toml`
- SQL insert (pg_cron + pg_net) pour le scheduling

## Phase 2 (ultérieure, pas dans ce sprint)
- Connecter Firecrawl pour les profils acheteurs HTML
- Optionnel : Lovable AI pour parsing intelligent des sources chaotiques
- Dashboard admin de monitoring des collectes

## Ordre d'implémentation
1. Migration DB
2. Edge Function BOAMP
3. Edge Function TED
4. Config toml
5. pg_cron scheduling

