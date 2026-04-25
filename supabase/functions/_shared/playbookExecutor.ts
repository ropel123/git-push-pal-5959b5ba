// playbookExecutor.ts
// Exécute une stratégie de scraping (template/hybrid/map) en appliquant
// les stop rules CÔTÉ CODE. L'IA n'intervient pas ici.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  PAGINATION_RULES,
  fingerprint,
  sha1,
  type PaginationRule,
} from "./paginationRules.ts";
import { firecrawlScrapeStructured } from "./firecrawlScrape.ts";
import { firecrawlMap } from "./firecrawlMap.ts";

export type ListStrategy = "template" | "hybrid" | "map" | "manual";
export type ScrapeMode = "FAST" | "DEEP" | "SMART";

export type Playbook = {
  id?: string;
  sourcing_url_id?: string;
  list_strategy?: ListStrategy;
  pagination_hint?: string;
  confidence: number;
  pagination?: {
    type?: string;
    param?: string;
    first_page?: number;
    url_template?: string;
  };
  selectors?: Record<string, string>;
};

export type ExecutorContext = {
  url: string;
  platform: string;
  mode: ScrapeMode;
  playbook?: Playbook | null;
  apiKey: string;
  supabase: SupabaseClient;
  sourcing_url_id: string;
};

export type ExecutorResult = {
  items: Array<Record<string, unknown>>;
  pages_scraped: number;
  calls_firecrawl: number;
  items_raw: number;
  items_after_dedup: number;
  items_new_vs_seen_cache: number;
  strategy_used: ListStrategy | "fallback";
  stopped_by:
    | "no_new_items"
    | "max_pages"
    | "budget"
    | "page_hash_repeat"
    | "partial_page"
    | "fast_mode"
    | "single_page"
    | "error";
  error_type?: ErrorType;
  error_message?: string;
};

export type ErrorType =
  | "selector_not_found"
  | "pagination_broken"
  | "list_empty_with_data_in_dom"
  | "network_timeout"
  | "firecrawl_5xx"
  | "rate_limited";

const MAX_CALLS_PER_URL = 10;
const FAST_MODE_PAGES = 1;

function pickRule(platform: string, playbook?: Playbook | null): PaginationRule | null {
  // Si playbook a une pagination déclarée + confidence ok → on la simule via une règle ad-hoc
  if (playbook?.pagination?.param && playbook.confidence >= 0.7) {
    const param = playbook.pagination.param;
    const firstPage = playbook.pagination.first_page ?? 1;
    return {
      firstPage,
      maxPages: 20,
      expectedPageSize: 10,
      buildPageUrl: (u, p) => {
        // Réutilise addParam du module de règles
        const url = new URL(u);
        url.searchParams.set(param, String(p));
        return url.toString();
      },
    };
  }
  return PAGINATION_RULES[platform] ?? null;
}

/** Hash du HTML pour détecter "même page renvoyée à 2 numéros différents". */
async function pageHash(s: string | null): Promise<string> {
  return s ? await sha1(s.slice(0, 5000)) : "";
}

async function loadSeenCache(
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

async function persistSeen(
  supabase: SupabaseClient,
  sourcing_url_id: string,
  newHashes: string[],
): Promise<void> {
  if (newHashes.length === 0) return;
  const rows = newHashes.map((h) => ({ sourcing_url_id, url_hash: h, last_seen_at: new Date().toISOString() }));
  await supabase.from("sourcing_seen_urls").upsert(rows, { onConflict: "sourcing_url_id,url_hash" });
}

/** Stratégie TEMPLATE : pagination GET déterministe. */
async function execTemplate(ctx: ExecutorContext, rule: PaginationRule): Promise<ExecutorResult> {
  const seenFp = new Set<string>();
  const seenPageHashes = new Set<string>();
  const items: Array<Record<string, unknown>> = [];
  let pages = 0;
  let calls = 0;
  let raw = 0;
  let stopped: ExecutorResult["stopped_by"] = "max_pages";

  const maxPages = ctx.mode === "FAST" ? FAST_MODE_PAGES : Math.min(rule.maxPages, MAX_CALLS_PER_URL);

  for (let p = rule.firstPage; p < rule.firstPage + maxPages; p++) {
    if (calls >= MAX_CALLS_PER_URL) {
      stopped = "budget";
      break;
    }
    const pageUrl = rule.buildPageUrl(ctx.url, p);
    let res;
    try {
      res = await firecrawlScrapeStructured(pageUrl, ctx.apiKey, { wantHtml: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        items, pages_scraped: pages, calls_firecrawl: calls,
        items_raw: raw, items_after_dedup: items.length, items_new_vs_seen_cache: 0,
        strategy_used: "template", stopped_by: "error",
        error_type: classifyMessage(msg), error_message: msg,
      };
    }
    calls++;
    pages++;
    raw += res.tenders.length;

    const ph = await pageHash(res.markdown);
    if (ph && seenPageHashes.has(ph)) {
      stopped = "page_hash_repeat";
      break;
    }
    if (ph) seenPageHashes.add(ph);

    const fresh = res.tenders.filter((t) => {
      const fp = fingerprint(t as Record<string, string>);
      if (seenFp.has(fp)) return false;
      seenFp.add(fp);
      return true;
    });

    if (fresh.length === 0) {
      stopped = "no_new_items";
      break;
    }
    items.push(...fresh);

    if (fresh.length < rule.expectedPageSize / 2 && p > rule.firstPage) {
      stopped = "partial_page";
      break;
    }
  }

  // Dédup vs seen cache
  const seenCache = await loadSeenCache(ctx.supabase, ctx.sourcing_url_id);
  const newHashes: string[] = [];
  let newCount = 0;
  for (const it of items) {
    const fp = fingerprint(it as Record<string, string>);
    const h = await sha1(fp);
    if (!seenCache.has(h)) {
      newHashes.push(h);
      newCount++;
    }
  }
  await persistSeen(ctx.supabase, ctx.sourcing_url_id, newHashes);

  return {
    items,
    pages_scraped: pages,
    calls_firecrawl: calls,
    items_raw: raw,
    items_after_dedup: items.length,
    items_new_vs_seen_cache: newCount,
    strategy_used: "template",
    stopped_by: stopped,
  };
}

/** Stratégie HYBRID : page 1 liste → liens détail → scrape détails. */
async function execHybrid(ctx: ExecutorContext): Promise<ExecutorResult> {
  let calls = 0;
  let res;
  try {
    res = await firecrawlScrapeStructured(ctx.url, ctx.apiKey);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return zeroResult("hybrid", "error", classifyMessage(msg), msg);
  }
  calls++;

  // En mode FAST : on s'arrête à la liste
  if (ctx.mode === "FAST") {
    return finalizeSimple(ctx, res.tenders, calls, "hybrid", "fast_mode");
  }

  // Sinon on récupère les liens détail pertinents (10-30 max)
  const detailLinks = (res.links ?? [])
    .filter((l: string) => /detail|consultation|refConsult|refPub|idCons|annonce/i.test(l))
    .filter((l: string) => !/login|inscription|recherche|search/i.test(l))
    .slice(0, Math.min(30, MAX_CALLS_PER_URL - calls));

  // On garde déjà les items de la liste
  const items = [...res.tenders];

  // Scraping détails (séquentiel pour budget contrôlé, concurrence=1)
  for (const link of detailLinks) {
    if (calls >= MAX_CALLS_PER_URL) break;
    try {
      const dr = await firecrawlScrapeStructured(link, ctx.apiKey);
      calls++;
      // Une page détail = en général 1 tender enrichi
      if (dr.tenders.length > 0) {
        // Forcer dce_url = link si absent
        for (const t of dr.tenders) {
          if (!t.dce_url) (t as Record<string, unknown>).dce_url = link;
        }
        items.push(...dr.tenders);
      }
    } catch {
      // skip ce détail
      calls++;
    }
  }

  return finalizeSimple(ctx, items, calls, "hybrid", "single_page");
}

/** Stratégie MAP : Firecrawl Map pour découvrir les liens, puis scrape détails. */
async function execMap(ctx: ExecutorContext): Promise<ExecutorResult> {
  let calls = 0;
  let mapRes;
  try {
    mapRes = await firecrawlMap(ctx.url, ctx.apiKey);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return zeroResult("map", "error", classifyMessage(msg), msg);
  }
  calls++;

  // Anti-doublon vs seen cache : ne scraper que les liens nouveaux
  const seenCache = await loadSeenCache(ctx.supabase, ctx.sourcing_url_id);
  const candidatesRaw = mapRes.links;
  const candidates: string[] = [];
  for (const l of candidatesRaw) {
    const h = await sha1(`url:${l.toLowerCase()}`);
    if (!seenCache.has(h)) candidates.push(l);
    if (candidates.length >= MAX_CALLS_PER_URL - 1) break;
  }

  // En mode FAST : on s'arrête à 3 détails max
  const budget = ctx.mode === "FAST" ? 3 : MAX_CALLS_PER_URL - calls;
  const toScrape = candidates.slice(0, budget);

  const items: Array<Record<string, unknown>> = [];
  for (const link of toScrape) {
    if (calls >= MAX_CALLS_PER_URL) break;
    try {
      const dr = await firecrawlScrapeStructured(link, ctx.apiKey);
      calls++;
      if (dr.tenders.length > 0) {
        for (const t of dr.tenders) {
          if (!t.dce_url) (t as Record<string, unknown>).dce_url = link;
        }
        items.push(...dr.tenders);
      }
    } catch {
      calls++;
    }
  }

  return finalizeSimple(ctx, items, calls, "map", ctx.mode === "FAST" ? "fast_mode" : "budget");
}

async function finalizeSimple(
  ctx: ExecutorContext,
  items: Array<Record<string, unknown>>,
  calls: number,
  strategy: ListStrategy,
  stopped: ExecutorResult["stopped_by"],
): Promise<ExecutorResult> {
  // Dédup interne
  const seenFp = new Set<string>();
  const dedup = items.filter((t) => {
    const fp = fingerprint(t as Record<string, string>);
    if (seenFp.has(fp)) return false;
    seenFp.add(fp);
    return true;
  });

  // Dédup vs seen cache
  const seenCache = await loadSeenCache(ctx.supabase, ctx.sourcing_url_id);
  const newHashes: string[] = [];
  let newCount = 0;
  for (const it of dedup) {
    const fp = fingerprint(it as Record<string, string>);
    const h = await sha1(fp);
    if (!seenCache.has(h)) {
      newHashes.push(h);
      newCount++;
    }
  }
  await persistSeen(ctx.supabase, ctx.sourcing_url_id, newHashes);

  return {
    items: dedup,
    pages_scraped: 1,
    calls_firecrawl: calls,
    items_raw: items.length,
    items_after_dedup: dedup.length,
    items_new_vs_seen_cache: newCount,
    strategy_used: strategy,
    stopped_by: stopped,
  };
}

function zeroResult(
  strategy: ListStrategy,
  stopped: ExecutorResult["stopped_by"],
  errType?: ErrorType,
  errMsg?: string,
): ExecutorResult {
  return {
    items: [],
    pages_scraped: 0,
    calls_firecrawl: 0,
    items_raw: 0,
    items_after_dedup: 0,
    items_new_vs_seen_cache: 0,
    strategy_used: strategy,
    stopped_by: stopped,
    error_type: errType,
    error_message: errMsg,
  };
}

function classifyMessage(msg: string): ErrorType {
  if (/timeout|aborted/i.test(msg)) return "network_timeout";
  if (/Firecrawl 5\d\d/.test(msg)) return "firecrawl_5xx";
  if (/429|rate/i.test(msg)) return "rate_limited";
  if (/selector|not found/i.test(msg)) return "selector_not_found";
  return "network_timeout";
}

/** Décide quelle stratégie utiliser selon playbook + plateforme + mode. */
export async function execute(ctx: ExecutorContext): Promise<ExecutorResult> {
  const pb = ctx.playbook;
  const platform = ctx.platform;

  // 1. Si playbook avec confidence >= 0.7 → on suit son list_strategy
  if (pb && pb.confidence >= 0.7 && pb.list_strategy) {
    if (pb.list_strategy === "hybrid") return execHybrid(ctx);
    if (pb.list_strategy === "map") return execMap(ctx);
    if (pb.list_strategy === "template") {
      const rule = pickRule(platform, pb);
      if (rule) return execTemplate(ctx, rule);
    }
  }

  // 2. Fallback v2 : règle déclarative connue ?
  const rule = PAGINATION_RULES[platform];
  if (rule) return execTemplate(ctx, rule);

  // 3. Plateforme dans MAP_BASED → map
  return execMap(ctx);
}
