## Plan v3.2 — Atexo robuste (puis pattern dupliqué sur autres familles)

### 🎯 Objectif

Sur l'URL test `portail.marchespublics.nc/...&AllCons` :
- **Avant** : 10 items récupérés sur ~40 disponibles
- **Après** : 35-40 items récupérés (objectif ≥90% de couverture)

Atexo est le pire cas (ASP.NET stateful + POST + VIEWSTATE). Si on le rend robuste, le pattern marche partout.

---

### 📐 Architecture — Nouvelle stratégie `atexo` en 3 couches

Ordre **STRICT** (pas l'inverse) :

```text
1. MAP-FIRST       → firecrawl.map filtré /consultation/{id}
   ├─ si ≥30 IDs uniques → STOP, on a tout
   └─ sinon → on garde les IDs trouvés et on passe à 2

2. LIST + pageSize=20  → 1 scrape avec &listePageSizeBottom=20
   ├─ extrait les IDs de la page 1 (jusqu'à 20)
   ├─ extrait nombrePageBottom (total pages réelles)
   ├─ MERGE avec les IDs du Map
   └─ si totalPages = 1 ou ratio_couverture ≥ 90% → STOP

3. ACTIONS pagination  → loop basée sur totalPages connu
   ├─ pour i de 2 à min(totalPages, MAX_PAGES=4)
   ├─ 1 scrape Firecrawl avec actions:[wait, click(next), wait, scrape]
   └─ MERGE IDs

4. DEDUP par ID consultation extrait du href (/consultation/(\d+))
```

**Limites strictes** : max 6 calls Firecrawl par URL Atexo (1 map + 1 list + 4 actions max). Au-delà → arrêt.

---

### 🔧 Modifications de code

#### A. Nouveau module `_shared/atexoExecutor.ts` (dédié)

Pourquoi un module dédié ? Atexo a une logique trop spécifique (ID-based dedup, 3 couches en cascade) pour rester dans le `playbookExecutor` générique. On garde le générique pour les autres familles.

```ts
export async function executeAtexo(ctx: ExecutorContext): Promise<ExecutorResult> {
  const allIds = new Map<string, ConsultationItem>(); // ID → item
  const stats = { map_urls: 0, list_urls: 0, actions_pages: 0, total_pages_detected: 0 };

  // === COUCHE 1 : MAP ===
  const mapRes = await firecrawlMap(baseHost, apiKey, { search: "consultation" });
  for (const url of mapRes.links) {
    const id = extractConsultationId(url);
    if (id) allIds.set(id, { id, url, source: "map" });
  }
  stats.map_urls = allIds.size;

  // Heuristique : si Map a ramené ≥30 IDs et la page d'accueil dit "moins de X"
  // → on s'arrête (avant: estimer X via list page 1 quand même)

  // === COUCHE 2 : LIST + pageSize=20 ===
  const listUrl = addParam(ctx.url, "listePageSizeBottom", "20");
  const listRes = await firecrawlScrapeStructured(listUrl, apiKey, { wantHtml: true });
  for (const t of listRes.tenders) {
    const id = extractConsultationId(t.dce_url);
    if (id && !allIds.has(id)) allIds.set(id, { id, ...t, source: "list" });
  }
  stats.list_urls = listRes.tenders.length;
  stats.total_pages_detected = parseTotalPages(listRes.raw_html); // depuis #...nombrePageBottom

  // Stop conditions
  if (stats.total_pages_detected <= 1) return finalize(allIds, "single_page", stats);
  if (allIds.size / (stats.total_pages_detected * 20) >= 0.9) return finalize(...);

  // === COUCHE 3 : ACTIONS pagination ===
  const MAX_ACTION_PAGES = Math.min(stats.total_pages_detected - 1, 4);
  for (let i = 0; i < MAX_ACTION_PAGES; i++) {
    if (calls >= MAX_CALLS_PER_URL) break;
    const actionRes = await firecrawlScrapeWithActions(listUrl, apiKey, [
      { type: "wait", milliseconds: 1500 },
      { type: "click", selector: "a[title*='page suivante'], a[title*='Aller à la page suivante']" },
      { type: "wait", milliseconds: 2000 },
      { type: "scrape" }
    ]);
    stats.actions_pages++;
    for (const t of actionRes.tenders) {
      const id = extractConsultationId(t.dce_url);
      if (id && !allIds.has(id)) allIds.set(id, { id, ...t, source: "actions" });
    }
  }

  return finalize(allIds, "completed", stats);
}
```

#### B. Étendre `firecrawlScrape.ts` avec une variante `withActions`

```ts
export async function firecrawlScrapeWithActions(
  url: string,
  apiKey: string,
  actions: FirecrawlAction[],
  opts?: ScrapeOptions
): Promise<ScrapeResult>
```

Réutilise la même extraction JSON (`TENDER_SCHEMA`) + `links`, juste avec `actions` dans le body.

#### C. Helpers nouveaux dans `paginationRules.ts`

```ts
export function extractConsultationId(url: string | undefined): string | null {
  if (!url) return null;
  // Match: /consultation/3014, /consultation/3014?orgAcronyme=xxx
  const m = url.match(/\/consultation\/(\d+)/);
  return m ? m[1] : null;
}

export function parseTotalPages(html: string | null): number {
  if (!html) return 1;
  // Cherche <span id="...nombrePageBottom">N</span>
  const m = html.match(/nombrePageBottom["'][^>]*>(\d+)</);
  return m ? parseInt(m[1], 10) : 1;
}

export function addParam(url: string, key: string, value: string): string {
  const u = new URL(url);
  u.searchParams.set(key, value);
  return u.toString();
}
```

#### D. Routing dans `scrape-list/index.ts`

```ts
if (platform === "atexo") {
  result = await executeAtexo(ctx);
} else {
  result = await playbookExecutor(ctx); // générique pour les autres
}
```

---

### 📊 Logging enrichi (metadata `scrape_logs`)

Au lieu du metadata actuel, on log :

```json
{
  "platform": "atexo",
  "strategy": "atexo_3layer",
  "stats": {
    "map_urls_found": 32,
    "list_urls_found": 20,
    "actions_pages_scraped": 2,
    "total_pages_detected": 4,
    "unique_consultations": 37,
    "items_per_page_actual": [20, 18]
  },
  "calls_firecrawl": 4,
  "stopped_by": "completed",
  "coverage_ratio": 0.925
}
```

→ Permet de voir d'un coup d'œil si la stratégie Atexo fait son job.

---

### 🧪 Validation après déploiement

1. Lancer un run sur `portail.marchespublics.nc/...&AllCons` en mode SMART
2. Vérifier dans `scrape_logs` :
   - `unique_consultations` ≥ 35
   - `coverage_ratio` ≥ 0.85
   - `calls_firecrawl` ≤ 6
3. Vérifier dans `tenders` : 30+ nouvelles consultations avec `dce_url` distinct
4. Vérifier l'idempotence : 2e run consécutif → 0 inserted (cache `sourcing_seen_urls` actif)

---

### 🚧 Garde-fous coût

| Garde-fou | Valeur |
|---|---|
| Max calls Firecrawl / URL Atexo | **6** (1 map + 1 list + 4 actions) |
| Max liens Map gardés | 100 (déjà en place) |
| Max pages via actions | **4** (au-delà = budget) |
| Hard timeout par scrape | 25s (déjà en place) |
| Total wait dans actions | <10s (compatible limite Firecrawl 60s) |

Coût estimé par run Atexo complet : **~$0.06** (6 calls × ~$0.01)

---

### 📦 Fichiers touchés

**Créés :**
- `supabase/functions/_shared/atexoExecutor.ts` (nouveau, ~180 lignes)

**Modifiés :**
- `supabase/functions/_shared/firecrawlScrape.ts` (+ `firecrawlScrapeWithActions`)
- `supabase/functions/_shared/paginationRules.ts` (+ helpers `extractConsultationId`, `parseTotalPages`, `addParam`)
- `supabase/functions/scrape-list/index.ts` (routing platform=atexo + logging stats)

**Pas touchés (volontairement) :**
- `playbookExecutor.ts` reste pour autres plateformes
- `scout-playbook` / `heal-playbook` pas modifiés cette fois (Atexo a sa logique en dur, pas de playbook IA)
- Pas de migration BDD

---

### 🗺️ Vision long terme (après validation Atexo)

Une fois Atexo stable, on duplique le pattern :

| Famille | Module dédié probable | Stratégie clé |
|---|---|---|
| **achatpublic.com** | `achatpublicExecutor.ts` | similaire (ASP.NET aussi) |
| **MPI / sarthe-mp** | `mpiExecutor.ts` | actions click sur "Suivant" |
| **klekoon / omnikles** | playbook générique map-only | URLs plates → map suffit |
| **e-marchespublics** | playbook template (template OK) | `?page=N` fonctionne |

---

### ✅ Ajustements de ta review intégrés

| Demande | Statut |
|---|---|
| MAP en priorité (pas fallback) | ✅ Couche 1 |
| ID-based dedup | ✅ `extractConsultationId` partout |
| Loop basée sur `totalPages` | ✅ `parseTotalPages` du DOM |
| Pas de click aveugle | ✅ Loop bornée par totalPages connu |
| Limite URLs Map | ✅ 100 hard cap (déjà) |
| Logging stats détaillé | ✅ `coverage_ratio` + breakdown |
| pageSize=20 systématique | ✅ Couche 2 |
| Pas de scrape massif map results | ✅ On extrait juste les IDs des liens map (pas de scrape par URL) |
