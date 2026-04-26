# Atexo detail-page enrichment (v3.5)

## Status: shipped

## Problem

Atexo list page (`?page=Entreprise.EntrepriseAdvancedSearch&AllCons`) does not contain title / buyer / deadline / reference in raw HTML — these columns are injected by JS at runtime. So the previous PRADO event-chain only got IDs, leaving every tender as `"Consultation Atexo {id}"` with NULL buyer/deadline.

## Solution

After the PRADO sweep collects all IDs, fetch each `/entreprise/consultation/{id}` page in HTTP brut (reusing PRADO session cookies), parse the labelled fields with regex, merge into the item data, then upsert.

Files added:
- `supabase/functions/_shared/atexoDetailParser.ts` — `fetchAtexoDetail()` + `enrichDetailsBatch()` (concurrent pool + budget)

Files modified:
- `supabase/functions/_shared/atexoExecutor.ts` — Firecrawl liste devient fallback (uniquement si HTTP brut échoue), nouveau STEP 4 d'enrichissement détail avant `finalize`

## Telemetry added to `_atexo_stats`

- `details_attempted` / `details_fetched` / `details_failed`
- `details_time_ms`
- `parser_match_rate` (0-1, 5 main fields)

## Settings

- Pool: 6 parallèles
- Per-fetch timeout: 8s
- Global budget: min(60s, remaining of 120s total)
