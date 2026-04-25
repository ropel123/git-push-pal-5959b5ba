
# Moteur de scraping multi-pages v3 — règles codées + Agent Scout (Claude)

## Vision

On ne construit pas un scraper, on construit un **framework autonome d'adaptation web** :
- **v2** : règles déclaratives codées par plateforme (rapide mais figé)
- **v3 (ce plan)** : règles apprises par Agent Scout (Claude) + fallback v2 + auto-réparation
- **v4 (futur)** : auto-optimisation continue à partir des métriques de runs

**Principe d'or** : l'IA propose, le code décide. L'IA ne tourne JAMAIS au runtime, uniquement offline (ajout d'URL ou réparation).

## Inventaire actuel (rappel)

91 URLs non-custom actives à travers 17 plateformes (atexo 27, achatpublic 16, mpi 15, omnikles 12…). Aujourd'hui : page 1 uniquement, perte 80-95%.

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1 — Onboarding URL (offline, 1 fois)                 │
│  ┌────────────────────────┐                                │
│  │ Pre-processor DOM      │  ← ÉTAPE CRITIQUE              │
│  │ - clean HTML (no JS/CSS)│                               │
│  │ - extract links         │                               │
│  │ - text sample           │                               │
│  └──────────┬──────────────┘                               │
│             ▼                                               │
│  ┌────────────────────────┐                                │
│  │ Agent Scout (Claude)   │  ← ~$0.005-0.01/URL            │
│  │ génère playbook v1     │                                │
│  └──────────┬──────────────┘                               │
│             ▼                                               │
│  ┌────────────────────────┐                                │
│  │ Validation côté code    │ confidence>=0.7 ? selectors ok?│
│  └──────────┬──────────────┘                               │
│             ▼                                               │
│  agent_playbooks (versionné, ancien préservé)              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ PHASE 2 — Runtime (toutes les 6h, ZERO IA)                 │
│                                                             │
│  Lookup playbook → exécute strategy                        │
│       │                                                     │
│       ├─ confidence >= 0.9 → full auto                     │
│       ├─ 0.7-0.9 → exec + log warning                      │
│       └─ < 0.7 → fallback PAGINATION_RULES (v2 codé)       │
│                                                             │
│  Pendant l'exécution, le CODE applique les stop rules :    │
│       if (newUniqueLinks === 0) stop;                      │
│       if (page > maxPages) stop;                           │
│       if (samePageHash) stop;                              │
│       if (callsUsed > MAX_CALLS_PER_URL) stop;             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ PHASE 3 — Auto-healing (déclenché par signal STRUCTUREL)   │
│                                                             │
│  fail_count >= 2 ET last_error_type IN (                   │
│    'selector_not_found',                                    │
│    'pagination_broken',                                     │
│    'list_empty_with_data_in_dom'                           │
│  ) → re-trigger Agent Scout (= Healer)                     │
│                                                             │
│  Network/timeout/Firecrawl 5xx → simple retry, pas de heal │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ PHASE 4 — Agent Live (manuel uniquement, bouton UI)        │
│  Browserbase + Claude pour cas extrêmes (1-clic "Débloquer")│
└─────────────────────────────────────────────────────────────┘
```

## Pre-processor DOM (clé du gain de tokens / précision)

`supabase/functions/_shared/domPreprocessor.ts` :

```ts
export function preprocess(html: string, baseUrl: string) {
  // 1. parser DOM (deno-dom)
  // 2. supprimer <script>, <style>, <svg>, <noscript>, <iframe>
  // 3. supprimer comments, attrs inutiles (style, onclick, data-*)
  // 4. extraire <body> uniquement
  // 5. tronquer à ~30 KB max (les listes utiles sont en haut)
  return {
    url: baseUrl,
    clean_dom: cleanedHtml,           // ~5-10 KB au lieu de 200 KB
    links: extractLinks(html, baseUrl), // tous les href absolutisés
    text_sample: extractText(html).slice(0, 3000),
    structural_hints: {
      has_table: /<table[^>]*>[\s\S]*?<\/table>/.test(html),
      has_pagination_widget: /pagination|next|suivant|page-/i.test(html),
      form_count: (html.match(/<form/g) || []).length,
    },
  };
}
```

Gain : **-70% tokens** envoyés à Claude → Scout passe de $0.03 à $0.005 par URL.

## Format playbook (versionné + signaux exploitables)

```ts
type Playbook = {
  // Versioning (jamais d'overwrite, on insert une nouvelle version)
  version: number;                  // 1, 2, 3…
  created_at: string;
  last_validated_at: string;
  fail_count: number;
  last_error_type?: ErrorType;
  is_active: boolean;               // un seul playbook actif par URL

  // Décision
  list_strategy: "template" | "hybrid" | "map" | "manual";
  pagination_hint: "numbered" | "next_button" | "infinite_scroll" | "none" | "unknown";
  confidence: number;               // 0-1 → décide auto / fallback / manuel

  // Pagination déterministe (si numbered)
  pagination?: {
    type: "url_param" | "url_path" | "form_post";
    param?: string;                 // ex: "PageNumber"
    first_page: number;             // 0 ou 1
    url_template?: string;          // "{base}&PageNumber={n}"
    max_pages_observed?: number;
  };

  // Sélecteurs CSS (utilisés par le pre-processor au runtime, PAS par l'IA)
  selectors: {
    list_rows: string;
    detail_link: string;
    next_page_indicator?: string;
  };

  // Évidence (debug + audit)
  evidence: string;                 // ex: "table.atexo-results detected"
  scout_model: string;              // claude-sonnet-4-5
  scout_tokens_used: number;
};

type ErrorType =
  | "selector_not_found"           // → trigger Healer
  | "pagination_broken"            // → trigger Healer
  | "list_empty_with_data_in_dom"  // → trigger Healer
  | "network_timeout"              // → simple retry
  | "firecrawl_5xx"                // → simple retry
  | "rate_limited";                // → backoff
```

## Exploitation du `confidence` (concret)

```ts
function executePlaybook(pb: Playbook, url: string) {
  if (pb.confidence < 0.5) {
    return { skip: true, reason: "manual_review_required" };
  }
  if (pb.confidence < 0.7) {
    return executeFallbackV2(url);  // règles codées PAGINATION_RULES
  }
  if (pb.confidence < 0.9) {
    const result = executePlaybookStrategy(pb, url);
    logWarning(`Low confidence playbook (${pb.confidence})`);
    return result;
  }
  return executePlaybookStrategy(pb, url);  // full auto
}
```

## Stop rules (côté CODE, jamais déléguées à l'IA)

```ts
const seenFingerprints = new Set<string>();
const seenPageHashes = new Set<string>();

for (let p = pb.pagination.first_page; p <= MAX_PAGES; p++) {
  const html = await fetchPage(buildUrl(p));
  const pageHash = sha1(html);
  if (seenPageHashes.has(pageHash)) break;       // page identique = fin
  seenPageHashes.add(pageHash);

  const items = extractWithSelectors(html, pb.selectors);
  const newItems = items.filter(it => !seenFingerprints.has(fp(it)));
  if (newItems.length === 0) break;              // VRAI signal de fin
  newItems.forEach(it => seenFingerprints.add(fp(it)));
  results.push(...newItems);

  if (callsUsed >= MAX_CALLS_PER_URL) break;     // budget par URL
  if (newItems.length < pb.expected_page_size / 2) break; // page partielle = dernière
}
```

## Stratégie Hybrid (l'optim qui fait la diff, exploitée à fond)

Pour atexo / achatpublic / mpi (gros volumes, listes peu informatives) :

1. Page 1 liste → extraire 10-30 **liens détail**
2. **STOP pagination liste**, on ne fait pas page 2-N
3. Scraper chaque page détail directement (parallèle, max 3) → données 3-5x plus riches
4. Si run suivant : même page 1, dédup par seen_urls cache → on ne re-scrape que les nouveaux détails

Gain : -80% appels Firecrawl, +300% qualité data.

## Auto-healing — trigger structurel uniquement

```ts
// Dans scrape-list, après échec :
const errorType = classifyError(error);
const shouldHeal = (
  pb.fail_count >= 2 &&
  ["selector_not_found", "pagination_broken", "list_empty_with_data_in_dom"]
    .includes(errorType)
);
if (shouldHeal) {
  await triggerHealer(sourcing_url_id);  // re-Scout, crée playbook v(N+1)
}
// errors network/timeout/5xx → simple retry, fail_count NON incrémenté
```

## Schéma DB

### Modification `agent_playbooks` (table existante)
```sql
alter table agent_playbooks
  add column sourcing_url_id uuid references sourcing_urls(id) on delete cascade,
  add column version integer not null default 1,
  add column confidence numeric not null default 0,
  add column pagination_hint text,
  add column last_validated_at timestamptz,
  add column fail_count integer not null default 0,
  add column last_error_type text,
  add column scout_model text,
  add column scout_tokens_used integer,
  add column evidence text;

create index on agent_playbooks (sourcing_url_id, is_active);
create unique index on agent_playbooks (sourcing_url_id, version);
-- Pas d'overwrite : un nouveau playbook = nouvelle ligne, ancien désactivé
```

### Nouvelle table `sourcing_seen_urls` (cache anti-doublon)
```sql
create table sourcing_seen_urls (
  sourcing_url_id uuid not null references sourcing_urls(id) on delete cascade,
  url_hash text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (sourcing_url_id, url_hash)
);
create index on sourcing_seen_urls (sourcing_url_id, last_seen_at);
-- TTL via cron quotidien : DELETE WHERE last_seen_at < now() - interval '30 days'
```

## Code à créer / modifier

### Nouveaux fichiers
- `supabase/functions/_shared/domPreprocessor.ts` — clean HTML + extract links/text
- `supabase/functions/_shared/paginationRules.ts` — table v2 (fallback déclaratif)
- `supabase/functions/_shared/playbookExecutor.ts` — exécute un playbook avec stop rules dures
- `supabase/functions/_shared/firecrawlMap.ts` — wrapper Map filtré (cap 100 URLs détail)
- `supabase/functions/scout-playbook/index.ts` — Agent Scout (Claude via Anthropic API)
- `supabase/functions/heal-playbook/index.ts` — Healer (re-Scout déclenché par signal structurel)

### Fichiers modifiés
- `supabase/functions/scrape-list/index.ts` — orchestrateur : lookup playbook → executor → fallback v2 → log
- `src/pages/Sourcing.tsx` :
  - colonne "Playbook" (version + confidence + last_validated)
  - bouton "Analyser avec IA" (déclenche Scout manuellement)
  - bouton "Débloquer" (déclenche Agent Live Browserbase, sur les URLs en échec répété)
  - mode FAST/DEEP/SMART par URL

### Migration data
- Reclassifications préalables (5 URLs mal taguées) :
  - `aws/colombes.fr` → `custom`
  - `domino/extranet.bordeaux.aeroport.fr` → `custom`
  - `e-marchespublics/www.e-marchespublics.com` racine → supprimer
  - `omnikles/*.safetender.com` (×2) → reclasser `safetender`
  - `eu-supply/synapse-entreprises.com` racine → supprimer

## Quand l'IA tourne (et combien ça coûte)

| Événement | Fréquence | Coût Claude |
|---|---|---|
| Ajout d'URL → Scout auto | ~5 nouvelles URLs/mois | ~$0.05 |
| Bouton "Analyser avec IA" → Scout manuel | à la demande | ~$0.01/clic |
| Healer (signal structurel) | ~5-10/mois estimés | ~$0.10 |
| Agent Live (Browserbase + Claude) | manuel uniquement | ~$0.30/clic |

**Total Anthropic estimé : $5-20/mois**. Le vrai coût reste Firecrawl (~$50-150/mois selon volume).

## Onboarding Scout — auto ou manuel ?

Je propose **manuel par défaut** : quand l'admin ajoute une URL, un bouton "Analyser avec IA" propose de générer le playbook. L'admin garde le contrôle des coûts ET valide la confidence avant activation. Auto-Scout activable globalement via un toggle Settings.

## Hors scope (v4 future)
- Auto-optimisation continue (apprendre des runs réussis pour affiner les selectors)
- Adapter API native PLACE
- Login automatisé Omnikles (déjà via `agent_playbooks` + Browserbase pour cas spécifiques)
- Playbook partagé entre projets (pattern multi-tenant)

## Questions ouvertes

1. **Modèle Scout** : `claude-sonnet-4-5` (qualité top, ~$0.005-0.01/URL après pre-processing) ou `claude-haiku-4-5` (3x moins cher mais selectors moins fiables) ? Je recommande Sonnet vu le faible volume.
2. **Onboarding Scout** : manuel via bouton (recommandé) ou auto à l'ajout ?
3. **Agent Live (Browserbase)** : on l'inclut dans cette v3 ou on le repousse à plus tard ? Coût d'implémentation = +1-2h.
4. **Reclassifications BDD** : je te génère un script SQL séparé que tu valides avant exécution, ou j'exécute les 5 corrections d'office ?
