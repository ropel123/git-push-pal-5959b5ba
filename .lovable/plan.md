

# Refonte du sourcing — Scraping multi-sites depuis URLs fournies

## Changement de stratégie

**On abandonne** le sourcing via les APIs officielles BOAMP et TED.

**On reconstruit** un système de sourcing basé sur une **liste d'URLs de plateformes** que tu vas me fournir (profils acheteurs, plateformes mutualisées, portails régionaux, etc.).

## Périmètre

**Supprimé :**
- `supabase/functions/scrape-boamp/` (820 lignes — appels API BOAMP)
- `supabase/functions/scrape-ted/` (670 lignes — appels API TED)
- Entrées `[functions.scrape-boamp]` et `[functions.scrape-ted]` dans `supabase/config.toml`
- Crons quotidiens 02:00 et 03:00

**Non touché (intact) :**
- `fetch-dce-agent`, `fetch-dce`, `batch-fetch-dce`
- Tables `agent_runs`, `agent_playbooks`, `agent_anonymous_identity`, `platform_robots`
- `AgentMonitor.tsx`, `DceAutoFetchButton`, `DceAgentFetchButton`
- Tables `dce_uploads`, `dce_downloads`
- Les 19 665 tenders existants restent en base

## Architecture cible

```text
┌─────────────────────────────────────────┐
│   Table : sourcing_urls                 │
│   - url, platform, frequency, active    │
│   - selectors (jsonb), last_run_at      │
└─────────────────┬───────────────────────┘
                  │ cron toutes les 6h
                  ▼
        ┌─────────────────────┐
        │  sourcing-scheduler │  ← lit les URLs actives, dispatch
        └──────────┬──────────┘
                   │
         ┌─────────┴──────────┐
         ▼                    ▼
  ┌─────────────┐      ┌──────────────┐
  │ scrape-list │      │ scrape-list  │   ← 1 fonction unifiée
  │  (URL #1)   │      │  (URL #2)    │     Firecrawl + parser
  └──────┬──────┘      └──────┬───────┘
         │ tenders bruts      │
         └──────────┬─────────┘
                    ▼
         ┌────────────────────┐
         │  upsert-tenders    │  ← normalisation + dédup
         └────────────────────┘
```

## Nouvelles tables

**`sourcing_urls`** — la liste de tes URLs à scraper :
```text
id              uuid PK
url             text          (URL de la page liste de consultations)
platform        text          (mpi, place, achatpublic, atexo, custom...)
display_name    text          (nom lisible du portail)
frequency_hours int           (défaut 6)
is_active       bool
selectors       jsonb         (sélecteurs CSS optionnels pour extraction custom)
parser_type     text          (auto | firecrawl_json | custom)
last_run_at     timestamptz
last_status     text
metadata        jsonb         (acheteur, région, notes...)
```

**`ingest_cursors`** — reprise sur incident par URL.

**Index unique** `tenders(source, reference)` pour idempotence SQL native (fini les hacks de dédup).

## Edge functions créées

| Fonction | Rôle | LoC |
|---|---|---|
| `sourcing-scheduler` | Cron toutes les 6h, sélectionne les URLs dues, lance les scrapers en parallèle (concurrence limitée) | ≤ 100 |
| `scrape-list` | Pour une URL : Firecrawl `scrape` + extraction JSON LLM (Lovable AI Gateway) → liste de consultations avec titre, référence, deadline, lien DCE, acheteur | ≤ 250 |
| `upsert-tenders` | Normalisation unifiée (region, contract_type, status), upsert SQL `(source, reference)`, merge `enriched_data` sans écrasement, écriture `scrape_logs` + `ingest_cursors` | ≤ 150 |

**Stratégie d'extraction** par URL :
1. **`auto`** (défaut) : Firecrawl `scrape` en format `json` avec un schéma Zod (titre, ref, deadline, dce_url, buyer, montant) + prompt LLM → marche sur 80 % des plateformes sans config.
2. **`firecrawl_json`** : schéma JSON custom passé dans `selectors`.
3. **`custom`** : sélecteurs CSS dans `selectors` pour les cas tordus.

## UI Admin (nouvelle page `/sourcing`)

Onglet visible uniquement aux admins :

- **Tableau des URLs** : url, plateforme, dernier run (date + résultat), nombre d'items récupérés au dernier run, statut actif/pause.
- **Bouton "Ajouter une URL"** : modal avec url, plateforme (autocomplete), fréquence, parser_type.
- **Bouton "Tester maintenant"** par URL : lance `scrape-list` en direct et affiche les résultats avant insert (dry-run).
- **Bouton "Re-scraper"** : force un run immédiat.
- **Bouton "Importer en masse"** : coller une liste d'URLs (une par ligne) avec auto-détection de la plateforme.
- **Logs** : derniers 50 runs (statut, items found / inserted / errors, durée).

Lien dans `AppSidebar` (visible admins) : "Sourcing".

## Workflow utilisateur

1. Tu approuves ce plan.
2. Je supprime `scrape-boamp` / `scrape-ted` et installe la nouvelle archi vide.
3. Tu me passes ta **liste d'URLs** (chat ou import via UI admin).
4. Pour chaque URL : je teste en dry-run, j'ajuste le parser si besoin, j'active le cron.
5. Le cron tourne toutes les 6h, l'admin voit la santé en direct.

## Garanties

- **Aucune perte** des 19 665 tenders existants.
- **Dédup SQL** sur `(source, reference)` → 0 doublon possible.
- **Merge** de `enriched_data` → l'agent DCE ne perd plus ses enrichissements.
- **Reprise sur incident** via `ingest_cursors`.
- **Coût plafonnable** (limite Firecrawl par jour configurable en table).
- L'agent DCE existant continue de fonctionner sur les nouveaux tenders sans modification.

## Détails techniques

- **Firecrawl** : déjà connecté (`FIRECRAWL_API_KEY` présente). On utilise `/v2/scrape` avec `formats: [{ type: 'json', schema, prompt }]` pour extraction structurée.
- **Pagination** : si la page liste a un `?page=N`, on boucle jusqu'à page vide ou max 20 pages.
- **Détection plateforme** : helper qui matche le hostname → `mpi`, `place`, `achatpublic`, `atexo`, `safetender`, `klekoon`, etc. Set par défaut sur `custom` si inconnu.
- **Parser unifié** : un seul endroit pour normaliser dates FR (`DD/MM/YYYY`), montants (`12 345,67 €`), références.
- **Concurrence** : `Promise.all` limité à 3 URLs simultanées dans le scheduler (économie Firecrawl).

## Prochaine étape après approbation

J'implémente l'archi vide + UI admin, puis **j'attends ta liste d'URLs** pour les ajouter et tester une par une.

