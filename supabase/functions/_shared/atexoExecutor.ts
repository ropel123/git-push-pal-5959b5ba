// atexoExecutor.ts v2 — stratégie révisée après inspection HTML réel.
//
// Constatations Atexo NC :
// - Firecrawl Map NE voit PAS les URLs /entreprise/consultation/{id} (générées dynamiquement)
// - Les IDs sont visibles DIRECTEMENT dans le HTML de la page liste (régex)
// - Lien "page suivante" : <a id="...PagerBottom_ctl2"> avec span.btn[title='Aller à la page suivante'] dedans
// - listePageSizeBottom est un <select> POST → param GET ignoré
// - nombrePageBottom dans <span id="...nombrePageBottom">N</span>
//
// Stratégie 2 couches :
// 1. SCRAPE LIST page 1 → extrait IDs du HTML + totalPages (1 call)
// 2. ACTIONS pagination → 1 call par page suivante (max 4)
//
// Dédup : par ID consultation. Budget : max 5 calls.

import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  extractConsultationId,
  parseTotalPages,
  sha1,
} from "./paginationRules.ts";
import {
  firecrawlScrapeStructured,
  firecrawlScrapeWithActions,
  type FirecrawlAction,
} from "./firecrawlScrape.ts";
import type { ExecutorContext, ExecutorResult } from "./playbookExecutor.ts";

const MAX_CALLS_PER_URL = 5;
const MAX_ACTION_PAGES = 4;

type ConsultationItem = {
  id: string;
  url?: string;
  source: "list_html" | "list_extract" | "actions";
  data?: Record<string, unknown>;
};

type AtexoStats = {
  ids_from_list_html: number;
  ids_from_list_extract: number;
  ids_from_actions: number;
  actions_pages_scraped: number;
  total_pages_detected: number;
  unique_consultations: number;
  items_per_page_actual: number[];
  coverage_ratio: number;
  pagination_mode: "input" | "click_fallback" | "none";
  dom_stuck_detected: boolean;
};


function baseHostUrl(fullUrl: string): string {
  const u = new URL(fullUrl);
  return `${u.protocol}//${u.host}`;
}

/** Extrait tous les IDs consultation visibles dans le HTML brut. */
function extractIdsFromHtml(html: string | null | undefined): string[] {
  if (!html) return [];
  const ids = new Set<string>();
  // Match: /entreprise/consultation/3018 ou /entreprise/consultation/3018?...
  const re = /\/entreprise\/consultation\/(\d+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    ids.add(m[1]);
  }
  return Array.from(ids);
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

/** Sélecteurs Atexo pour la pagination input-driven (vrai backend ASP.NET). */
const PAGE_INPUT_SELECTOR = "input[name*='numPageBottom'], input[id*='numPageBottom']";
const SUBMIT_BUTTON_SELECTOR =
  "input[name*='DefaultButtonBottom'], input[id*='DefaultButtonBottom']";

/** Sélecteurs fallback pour click "page suivante" (si input absent). */
const NEXT_PAGE_SELECTORS = [
  "a[id*='PagerBottom_ctl2']",
  "a[id*='PagerBottom_ctl3']",
  "a[title*='page suivante' i]",
  "a:has(span[title*='page suivante' i])",
].join(", ");

/**
 * Pagination input-driven : remplir numPageBottom + click submit caché.
 * Plus fiable qu'un click "page suivante" sur les sites stateful (postback ASP.NET).
 * On évite press Enter à cause d'un bug Firecrawl connu (#705).
 */
function buildInputDrivenActions(targetPage: number): FirecrawlAction[] {
  return [
    { type: "wait", milliseconds: 1200 },
    // Focus le champ numPageBottom
    { type: "click", selector: PAGE_INPUT_SELECTOR },
    // Efface la valeur courante (3x backspace pour gérer "1", "10", "100")
    { type: "press", key: "Backspace" },
    { type: "press", key: "Backspace" },
    { type: "press", key: "Backspace" },
    { type: "write", text: String(targetPage) },
    { type: "wait", milliseconds: 300 },
    // Soumet via le bouton hidden d'Atexo (plus fiable que press Enter)
    { type: "click", selector: SUBMIT_BUTTON_SELECTOR },
    { type: "wait", milliseconds: 2500 },
    { type: "scrape" },
  ];
}

/** Fallback si input-driven échoue : N clicks séquentiels "page suivante". */
function buildClickNextActions(stepCount: number): FirecrawlAction[] {
  const actions: FirecrawlAction[] = [];
  for (let i = 0; i < stepCount; i++) {
    actions.push({ type: "wait", milliseconds: 1200 });
    actions.push({ type: "click", selector: NEXT_PAGE_SELECTORS });
  }
  actions.push({ type: "wait", milliseconds: 2500 });
  actions.push({ type: "scrape" });
  return actions;
}


export async function executeAtexo(ctx: ExecutorContext): Promise<ExecutorResult> {
  const allIds = new Map<string, ConsultationItem>();
  const stats: AtexoStats = {
    ids_from_list_html: 0,
    ids_from_list_extract: 0,
    ids_from_actions: 0,
    actions_pages_scraped: 0,
    total_pages_detected: 1,
    unique_consultations: 0,
    items_per_page_actual: [],
    coverage_ratio: 0,
    pagination_mode: "none",
    dom_stuck_detected: false,
  };
  let calls = 0;
  let stoppedBy: ExecutorResult["stopped_by"] = "single_page";

  // ============== COUCHE 1 : LIST page 1 ==============
  let listRes;
  try {
    listRes = await firecrawlScrapeStructured(ctx.url, ctx.apiKey, {
      wantHtml: true,
      timeoutMs: 30_000,
    });
    calls++;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return finalize(ctx, allIds, stats, calls, "error", "network_timeout", msg);
  }

  // 1a. IDs depuis le HTML brut (gratuit, exhaustif sur la page)
  const htmlIds = extractIdsFromHtml(listRes.raw_html);
  for (const id of htmlIds) {
    if (!allIds.has(id)) {
      allIds.set(id, {
        id,
        url: `${baseHostUrl(ctx.url)}/entreprise/consultation/${id}`,
        source: "list_html",
      });
    }
  }
  stats.ids_from_list_html = htmlIds.length;

  // 1b. Items extraits par l'IA (avec data structurée) → enrichit
  for (const t of listRes.tenders) {
    const id = extractConsultationId(t.dce_url as string | undefined);
    if (id) {
      const existing = allIds.get(id);
      if (existing) {
        existing.data = t;
        existing.source = "list_extract";
      } else {
        allIds.set(id, {
          id,
          url: t.dce_url as string | undefined,
          source: "list_extract",
          data: t,
        });
      }
    }
  }
  stats.ids_from_list_extract = listRes.tenders.length;
  stats.items_per_page_actual.push(allIds.size);
  stats.total_pages_detected = parseTotalPages(listRes.raw_html);

  console.log(
    `[atexo] LIST: ${htmlIds.length} IDs from HTML, ${listRes.tenders.length} structured, totalPages=${stats.total_pages_detected}`,
  );

  // Stop conditions
  if (stats.total_pages_detected <= 1) {
    stoppedBy = "single_page";
  } else if (ctx.mode === "FAST") {
    stoppedBy = "fast_mode";
  } else {
    // ============== COUCHE 2 : ACTIONS pagination input-driven ==============
    const pagesToFetch = Math.min(stats.total_pages_detected - 1, MAX_ACTION_PAGES);
    let consecutiveNoNew = 0;
    let useClickFallback = false;

    // IDs de la page précédente, pour détecter "DOM stuck" (= AJAX qui ne refresh pas)
    let prevPageIds = new Set(htmlIds);

    for (let pageOffset = 0; pageOffset < pagesToFetch; pageOffset++) {
      if (calls >= MAX_CALLS_PER_URL) {
        stoppedBy = "budget";
        break;
      }

      const targetPage = pageOffset + 2; // page 1 déjà faite, on attaque page 2

      // Choix de la stratégie d'actions
      const actions = useClickFallback
        ? buildClickNextActions(pageOffset + 1)
        : buildInputDrivenActions(targetPage);

      try {
        const actionRes = await firecrawlScrapeWithActions(
          ctx.url,
          ctx.apiKey,
          actions,
          { wantHtml: true, timeoutMs: 50_000 },
        );
        calls++;
        stats.actions_pages_scraped++;
        if (stats.pagination_mode === "none") {
          stats.pagination_mode = useClickFallback ? "click_fallback" : "input";
        }

        const beforeCount = allIds.size;

        // IDs depuis le HTML brut de cette page
        const pageIds = extractIdsFromHtml(actionRes.raw_html);
        const pageIdSet = new Set(pageIds);

        // === Détection DOM stuck : exactement les mêmes IDs que la page précédente ===
        const sameAsPrev =
          pageIds.length > 0 &&
          pageIds.length === prevPageIds.size &&
          pageIds.every((id) => prevPageIds.has(id));

        if (sameAsPrev) {
          stats.dom_stuck_detected = true;
          console.warn(
            `[atexo] DOM stuck detected on page ${targetPage} (mode=${stats.pagination_mode}) — same IDs as previous`,
          );
          if (!useClickFallback) {
            // 1ère tentative input-driven a échoué → bascule click et REFAIT cette page
            console.log(`[atexo] switching to click_fallback mode`);
            useClickFallback = true;
            pageOffset--; // on retentera cette page
            continue;
          } else {
            // Déjà en fallback et toujours stuck → on arrête
            stoppedBy = "no_new_items";
            break;
          }
        }

        // Merge IDs
        for (const id of pageIds) {
          if (!allIds.has(id)) {
            allIds.set(id, {
              id,
              url: `${baseHostUrl(ctx.url)}/entreprise/consultation/${id}`,
              source: "actions",
            });
          }
        }

        // Enrichir avec données structurées
        for (const t of actionRes.tenders) {
          const id = extractConsultationId(t.dce_url as string | undefined);
          if (id) {
            const existing = allIds.get(id);
            if (existing && !existing.data) {
              existing.data = t;
            } else if (!existing) {
              allIds.set(id, {
                id,
                url: t.dce_url as string | undefined,
                source: "actions",
                data: t,
              });
            }
          }
        }

        const newOnThisPage = allIds.size - beforeCount;
        stats.items_per_page_actual.push(pageIds.length);
        stats.ids_from_actions += newOnThisPage;
        console.log(
          `[atexo] ACTIONS page ${targetPage} (${stats.pagination_mode}): ${pageIds.length} IDs visible, +${newOnThisPage} new`,
        );

        prevPageIds = pageIdSet;

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
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[atexo] ACTIONS page ${targetPage} failed:`, msg);
        // Si l'action input-driven plante (ex: input introuvable) → bascule click
        if (!useClickFallback && /element not found|selector/i.test(msg)) {
          console.log(`[atexo] input-driven failed → switching to click_fallback`);
          useClickFallback = true;
          pageOffset--; // retente
          continue;
        }
        // Sinon on arrête mais on garde ce qu'on a
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
  const totalExpected = Math.max(stats.total_pages_detected * 10, allIds.size);
  stats.coverage_ratio =
    totalExpected > 0 ? Math.round((allIds.size / totalExpected) * 100) / 100 : 0;

  // Build items pour upsert
  const baseHost = baseHostUrl(ctx.url);
  const items: Array<Record<string, unknown>> = [];
  for (const c of allIds.values()) {
    const dceUrl = (c.data?.dce_url as string | undefined) || c.url || `${baseHost}/entreprise/consultation/${c.id}`;
    if (c.data) {
      items.push({ ...c.data, dce_url: dceUrl, reference: c.data.reference || c.id });
    } else {
      items.push({
        title: `Consultation Atexo ${c.id}`,
        reference: c.id,
        dce_url: dceUrl,
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
    items_raw: stats.ids_from_list_html + stats.ids_from_actions,
    items_after_dedup: allIds.size,
    items_new_vs_seen_cache: newCount,
    strategy_used: "hybrid",
    stopped_by: stoppedBy,
    error_type: errorType,
    error_message: errorMessage,
    // @ts-ignore — extension dynamique pour logging
    _atexo_stats: stats,
  } as ExecutorResult;
}
