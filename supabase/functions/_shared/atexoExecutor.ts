// atexoExecutor.ts
// Stratégie 3 couches dédiée Atexo (ASP.NET stateful, POST + VIEWSTATE).
//
// 1. MAP-FIRST   → firecrawl.map filtré /consultation/{id}
// 2. LIST + pageSize=20 → 1 scrape, extrait totalPages depuis nombrePageBottom
// 3. ACTIONS pagination → loop bornée par totalPages (click "page suivante")
//
// Dédup : par ID consultation (clé naturelle, pas hash de contenu).
// Budget : max 6 calls Firecrawl (1 map + 1 list + max 4 actions).

import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  addParam,
  extractConsultationId,
  parseTotalPages,
  sha1,
} from "./paginationRules.ts";
import {
  firecrawlScrapeStructured,
  firecrawlScrapeWithActions,
  type FirecrawlAction,
} from "./firecrawlScrape.ts";
import { firecrawlMap } from "./firecrawlMap.ts";
import type { ExecutorContext, ExecutorResult } from "./playbookExecutor.ts";

const MAX_CALLS_PER_URL = 6;
const MAX_ACTION_PAGES = 4;
const MAP_SUFFICIENT_THRESHOLD = 30; // si Map ≥ 30 IDs uniques → on saute la suite

type ConsultationItem = {
  id: string;
  url?: string;
  source: "map" | "list" | "actions";
  data?: Record<string, unknown>;
};

type AtexoStats = {
  map_urls_found: number;
  list_urls_found: number;
  actions_pages_scraped: number;
  total_pages_detected: number;
  unique_consultations: number;
  items_per_page_actual: number[];
  coverage_ratio: number;
};

function baseHostUrl(fullUrl: string): string {
  const u = new URL(fullUrl);
  return `${u.protocol}//${u.host}`;
}

async function persistSeenIds(
  supabase: SupabaseClient,
  sourcing_url_id: string,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  const rows = await Promise.all(
    ids.map(async (id) => ({
      sourcing_url_id,
      url_hash: await sha1(`atexo:${id}`),
      last_seen_at: new Date().toISOString(),
    })),
  );
  await supabase
    .from("sourcing_seen_urls")
    .upsert(rows, { onConflict: "sourcing_url_id,url_hash" });
}

async function loadSeenIdHashes(
  supabase: SupabaseClient,
  sourcing_url_id: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from("sourcing_seen_urls")
    .select("url_hash")
    .eq("sourcing_url_id", sourcing_url_id)
    .limit(5000);
  return new Set((data ?? []).map((r: { url_hash: string }) => r.url_hash));
}

export async function executeAtexo(ctx: ExecutorContext): Promise<ExecutorResult> {
  const allIds = new Map<string, ConsultationItem>();
  const stats: AtexoStats = {
    map_urls_found: 0,
    list_urls_found: 0,
    actions_pages_scraped: 0,
    total_pages_detected: 1,
    unique_consultations: 0,
    items_per_page_actual: [],
    coverage_ratio: 0,
  };
  let calls = 0;
  let stoppedBy: ExecutorResult["stopped_by"] = "single_page";

  // ============== COUCHE 1 : MAP ==============
  try {
    const mapRes = await firecrawlMap(baseHostUrl(ctx.url), ctx.apiKey, {
      search: "consultation",
    });
    calls++;
    for (const url of mapRes.links) {
      const id = extractConsultationId(url);
      if (id && !allIds.has(id)) {
        allIds.set(id, { id, url, source: "map" });
      }
    }
    stats.map_urls_found = allIds.size;
    console.log(`[atexo] MAP: ${mapRes.total_found} found, ${mapRes.total_kept} kept, ${stats.map_urls_found} unique IDs`);
  } catch (e) {
    console.warn(`[atexo] MAP failed (non-fatal):`, e instanceof Error ? e.message : e);
  }

  // ============== COUCHE 2 : LIST + pageSize=20 ==============
  // Force la taille de page à 20 pour minimiser le nombre de pages réelles
  const listUrl = addParam(ctx.url, "listePageSizeBottom", 20);

  let listRes;
  try {
    listRes = await firecrawlScrapeStructured(listUrl, ctx.apiKey, {
      wantHtml: true,
    });
    calls++;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Si la liste plante mais qu'on a des IDs map → on continue avec ce qu'on a
    if (allIds.size === 0) {
      return finalize(ctx, allIds, stats, calls, "error", "network_timeout", msg);
    }
    console.warn(`[atexo] LIST failed but Map has ${allIds.size} IDs:`, msg);
    listRes = null;
  }

  if (listRes) {
    const beforeListMerge = allIds.size;
    for (const t of listRes.tenders) {
      const id = extractConsultationId(t.dce_url as string | undefined);
      if (id) {
        const existing = allIds.get(id);
        if (existing) {
          // Enrichit avec les data structurées du list
          existing.data = t;
        } else {
          allIds.set(id, { id, url: t.dce_url as string | undefined, source: "list", data: t });
        }
      }
    }
    stats.list_urls_found = listRes.tenders.length;
    stats.items_per_page_actual.push(listRes.tenders.length);
    stats.total_pages_detected = parseTotalPages(listRes.raw_html);
    console.log(`[atexo] LIST: +${allIds.size - beforeListMerge} new IDs, totalPages=${stats.total_pages_detected}`);
  }

  // Stop conditions après List
  if (stats.total_pages_detected <= 1) {
    stoppedBy = "single_page";
  } else if (
    stats.map_urls_found >= MAP_SUFFICIENT_THRESHOLD &&
    allIds.size >= stats.total_pages_detected * 18 // ~90% de couverture estimée
  ) {
    stoppedBy = "no_new_items";
  } else if (ctx.mode === "FAST") {
    stoppedBy = "fast_mode";
  } else {
    // ============== COUCHE 3 : ACTIONS pagination ==============
    const pagesToFetch = Math.min(stats.total_pages_detected - 1, MAX_ACTION_PAGES);
    let consecutiveNoNew = 0;

    for (let pageOffset = 0; pageOffset < pagesToFetch; pageOffset++) {
      if (calls >= MAX_CALLS_PER_URL) {
        stoppedBy = "budget";
        break;
      }

      // On clique N+1 fois "page suivante" pour atteindre la page cible
      // Construction des actions : (wait + click) * (pageOffset+1), puis wait final + scrape
      const actions: FirecrawlAction[] = [];
      for (let click = 0; click <= pageOffset; click++) {
        actions.push({ type: "wait", milliseconds: 1200 });
        actions.push({
          type: "click",
          selector:
            "a[title*='page suivante' i], a[title*='Aller à la page suivante' i], a[id*='PageSuivant' i]",
        });
      }
      actions.push({ type: "wait", milliseconds: 2000 });
      actions.push({ type: "scrape" });

      try {
        const actionRes = await firecrawlScrapeWithActions(
          listUrl,
          ctx.apiKey,
          actions,
        );
        calls++;
        stats.actions_pages_scraped++;
        stats.items_per_page_actual.push(actionRes.tenders.length);

        const beforeActionMerge = allIds.size;
        for (const t of actionRes.tenders) {
          const id = extractConsultationId(t.dce_url as string | undefined);
          if (id && !allIds.has(id)) {
            allIds.set(id, {
              id,
              url: t.dce_url as string | undefined,
              source: "actions",
              data: t,
            });
          }
        }
        const newOnThisPage = allIds.size - beforeActionMerge;
        console.log(`[atexo] ACTIONS page ${pageOffset + 2}: +${newOnThisPage} new IDs`);

        if (newOnThisPage === 0) {
          consecutiveNoNew++;
          if (consecutiveNoNew >= 2) {
            stoppedBy = "no_new_items";
            break;
          }
        } else {
          consecutiveNoNew = 0;
        }
      } catch (e) {
        console.warn(`[atexo] ACTIONS page ${pageOffset + 2} failed:`, e instanceof Error ? e.message : e);
        // On continue avec ce qu'on a, pas de fail global
        break;
      }
    }

    if (stoppedBy === "single_page") stoppedBy = "max_pages";
  }

  return finalize(ctx, allIds, stats, calls, stoppedBy);
}

async function finalize(
  ctx: ExecutorContext,
  allIds: Map<string, ConsultationItem>,
  stats: AtexoStats,
  calls: number,
  stoppedBy: ExecutorResult["stopped_by"],
  errorType?: ExecutorResult["error_type"],
  errorMessage?: string,
): Promise<ExecutorResult> {
  stats.unique_consultations = allIds.size;
  const totalExpected = Math.max(stats.total_pages_detected * 20, allIds.size);
  stats.coverage_ratio =
    totalExpected > 0 ? Math.round((allIds.size / totalExpected) * 100) / 100 : 0;

  // Build items : on prend les data structurées si dispo, sinon synthèse minimale
  const baseHost = baseHostUrl(ctx.url);
  const items: Array<Record<string, unknown>> = [];
  for (const c of allIds.values()) {
    if (c.data) {
      items.push({
        ...c.data,
        dce_url: c.data.dce_url || c.url || `${baseHost}/entreprise/consultation/${c.id}`,
      });
    } else {
      // Item venant du Map seul (pas de data) : on le garde quand même avec URL
      items.push({
        title: `Consultation ${c.id}`,
        reference: c.id,
        dce_url: c.url || `${baseHost}/entreprise/consultation/${c.id}`,
      });
    }
  }

  // Dédup vs seen cache (par ID)
  const seenCache = await loadSeenIdHashes(ctx.supabase, ctx.sourcing_url_id);
  const newIds: string[] = [];
  let newCount = 0;
  for (const c of allIds.values()) {
    const h = await sha1(`atexo:${c.id}`);
    if (!seenCache.has(h)) {
      newIds.push(c.id);
      newCount++;
    }
  }
  await persistSeenIds(ctx.supabase, ctx.sourcing_url_id, newIds);

  console.log(
    `[atexo] DONE: ${allIds.size} unique, ${newCount} new vs cache, ${calls} calls, coverage=${stats.coverage_ratio}, stopped=${stoppedBy}`,
  );

  return {
    items,
    pages_scraped: 1 + stats.actions_pages_scraped,
    calls_firecrawl: calls,
    items_raw: stats.list_urls_found + stats.items_per_page_actual.slice(1).reduce((a, b) => a + b, 0),
    items_after_dedup: allIds.size,
    items_new_vs_seen_cache: newCount,
    strategy_used: "hybrid", // type-compat (atexo n'est pas un ListStrategy enum)
    stopped_by: stoppedBy,
    error_type: errorType,
    error_message: errorMessage,
    // @ts-ignore — extension dynamique pour logging enrichi
    _atexo_stats: stats,
  } as ExecutorResult;
}
