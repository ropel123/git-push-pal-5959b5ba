// atexoExecutor.ts v3 — PRADO event-chain (Plan v3.4.1)
//
// Diagnostic : Atexo tourne sur PRADO (PHP, équivalent ASP.NET WebForms).
// Pagination = postback stateful : PRADO_PAGESTATE + _csrf_token + cookies.
// Firecrawl ouvre un navigateur neuf à chaque call → état perdu → page 1 toujours.
//
// Stratégie v3.4.1 :
//   1. fetchInitialPage(url) en HTTP brut → state₀, cookies₀, IDs page 1
//   2. Détecte engine "prado_event_chain" via marqueurs HTML
//   3. Boucle event-chain SÉQUENTIELLE :
//        state = state₀
//        for i in 1..N:
//          target = extractNextPagerEventTarget(lastHtml)
//          { html, state } = await postEvent(state, target)   // chaining strict
//          merge IDs
//   4. Fallback v3.3 (Firecrawl actions) si engine non détecté
//
// Garde-fous : MAX_PAGES_PER_RUN=8, séquentiel (pas de Promise.all),
// pagestate doit être présent dans chaque réponse (sinon stop).

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
import {
  extractCurrentPage,
  extractFormState,
  extractIdsFromHtml as extractIdsFromHtmlPrado,
  extractNextPagerEventTarget,
  extractTotalPages as extractTotalPagesPrado,
  fetchInitialPage,
  isPradoHtml,
  postEvent,
  type FormState,
} from "./pradoClient.ts";
import { enrichDetailsBatch } from "./atexoDetailParser.ts";
import type { ExecutorContext, ExecutorResult } from "./playbookExecutor.ts";

// PRADO mode — HTTP only, very cheap, can afford many pages
// Cap raised from 8 → 25: covers 99% of Atexo platforms (most have 5-20 pages).
// At ~1s per POST, full sweep stays well under MAX_TOTAL_TIME_MS.
const MAX_PAGES_PER_RUN = 25;
const TIMEOUT_PER_POST_MS = 15_000;
const MAX_TOTAL_TIME_MS = 120_000;

// Detail page enrichment (per consultation, HTTP brut)
const DETAIL_POOL_SIZE = 6;
const DETAIL_TIMEOUT_MS = 8_000;
const DETAIL_BUDGET_MS = 60_000;

// Firecrawl fallback — kept for non-PRADO Atexo-like portals
const MAX_CALLS_PER_URL_FC = 5;
const MAX_ACTION_PAGES_FC = 4;

type Engine = "prado_event_chain" | "firecrawl_fallback";

type ConsultationItem = {
  id: string;
  url?: string;
  source: "list_html" | "list_extract" | "actions" | "prado_chain";
  data?: Record<string, unknown>;
};

type AtexoStats = {
  engine: Engine;
  ids_from_list_html: number;
  ids_from_list_extract: number;
  ids_from_actions: number;
  actions_pages_scraped: number;
  total_pages_detected: number;
  unique_consultations: number;
  items_per_page_actual: number[];
  coverage_ratio: number;
  pagination_mode: "prado_event_chain" | "input" | "click_fallback" | "none";
  dom_stuck_detected: boolean;
  // PRADO-specific
  pagestate_rotations: number;
  csrf_rotations: number;
  cookies_rotations: number;
  http_status_per_page: number[];
  event_targets_used: string[];
  hidden_inputs_count: number;
  pagestate_lost: boolean;
  // Sweep telemetry
  max_pages_cap: number;
  pages_planned: number;
  time_elapsed_ms: number;
  stop_reason_detail: string;
  consecutive_http_errors: number;
  // Detail enrichment telemetry
  details_attempted: number;
  details_fetched: number;
  details_failed: number;
  details_time_ms: number;
  parser_match_rate: number;
};

function baseHostUrl(fullUrl: string): string {
  const u = new URL(fullUrl);
  return `${u.protocol}//${u.host}`;
}

/** Legacy regex-based ID extraction (used as fallback for Firecrawl mode). */
function extractIdsFromHtml(html: string | null | undefined): string[] {
  if (!html) return [];
  const ids = new Set<string>();
  const re = /\/entreprise\/consultation\/(\d+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) ids.add(m[1]);
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

// ============================================================================
//                          MAIN ENTRY POINT
// ============================================================================

export async function executeAtexo(ctx: ExecutorContext): Promise<ExecutorResult> {
  const allIds = new Map<string, ConsultationItem>();
  const stats: AtexoStats = {
    engine: "firecrawl_fallback",
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
    pagestate_rotations: 0,
    csrf_rotations: 0,
    cookies_rotations: 0,
    http_status_per_page: [],
    event_targets_used: [],
    hidden_inputs_count: 0,
    pagestate_lost: false,
    max_pages_cap: MAX_PAGES_PER_RUN,
    pages_planned: 0,
    time_elapsed_ms: 0,
    stop_reason_detail: "",
    consecutive_http_errors: 0,
    details_attempted: 0,
    details_fetched: 0,
    details_failed: 0,
    details_time_ms: 0,
    parser_match_rate: 0,
  };
  const runStartTime = Date.now();
  let calls = 0;
  let stoppedBy: ExecutorResult["stopped_by"] = "single_page";

  // ============== STEP 1 : initial fetch (HTTP brut, gratuit) ==============
  let initialHtml: string;
  let pradoState: FormState | null = null;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    const initial = await fetchInitialPage(ctx.url, ctrl.signal);
    clearTimeout(timer);
    initialHtml = initial.html;
    stats.http_status_per_page.push(initial.status);

    if (isPradoHtml(initialHtml)) {
      stats.engine = "prado_event_chain";
      stats.pagination_mode = "prado_event_chain";
      pradoState = initial.state;
      stats.hidden_inputs_count = pradoState.hiddenInputs.size;
      console.log(
        `[atexo] engine=prado_event_chain, hidden_inputs=${stats.hidden_inputs_count}, ` +
          `pagestate=${pradoState.pageState ? pradoState.pageState.length + " bytes" : "MISSING"}, ` +
          `csrf=${pradoState.csrfToken ? "yes" : "no"}`,
      );
    } else {
      console.log(`[atexo] engine=firecrawl_fallback (no PRADO markers)`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[atexo] initial HTTP fetch failed: ${msg} — falling back to Firecrawl`);
    initialHtml = "";
  }

  // Page 1 IDs (from the HTTP fetch if we have it; otherwise from Firecrawl below)
  if (initialHtml) {
    const ids = extractIdsFromHtmlPrado(initialHtml);
    for (const id of ids) {
      if (!allIds.has(id)) {
        allIds.set(id, {
          id,
          url: `${baseHostUrl(ctx.url)}/entreprise/consultation/${id}`,
          source: "list_html",
        });
      }
    }
    stats.ids_from_list_html = ids.length;
    stats.total_pages_detected = extractTotalPagesPrado(initialHtml);
    stats.items_per_page_actual.push(ids.length);
    console.log(
      `[atexo] page 1 (HTTP): ${ids.length} IDs, totalPages=${stats.total_pages_detected}`,
    );
  }

  // ============== STEP 2a : Firecrawl FALLBACK only if HTTP brut a échoué ==============
  // En mode PRADO normal, la page liste ne contient PAS les titres/buyers/dates
  // (elles sont injectées en AJAX au runtime). On enrichit donc plus tard via
  // les pages détail. Firecrawl n'est utile que si le HTTP brut a totalement
  // échoué (captcha/403) — auquel cas on tente de récupérer au moins les IDs.
  if (!initialHtml) {
    try {
      const listRes = await firecrawlScrapeStructured(ctx.url, ctx.apiKey, {
        wantHtml: true,
        timeoutMs: 30_000,
      });
      calls++;
      if (listRes.raw_html) {
        const ids = extractIdsFromHtml(listRes.raw_html);
        for (const id of ids) {
          if (!allIds.has(id)) {
            allIds.set(id, {
              id,
              url: `${baseHostUrl(ctx.url)}/entreprise/consultation/${id}`,
              source: "list_html",
            });
          }
        }
        stats.ids_from_list_html = ids.length;
        stats.total_pages_detected = parseTotalPages(listRes.raw_html);
        stats.items_per_page_actual.push(ids.length);
      }
      // Bonus : Firecrawl LLM-extract peut quand même catcher quelques tenders
      // sur les skins Atexo qui rendent partiellement côté serveur.
      for (const t of listRes.tenders) {
        const id = extractConsultationId(t.dce_url as string | undefined);
        if (id) {
          const existing = allIds.get(id);
          if (existing) existing.data = t;
          else allIds.set(id, { id, url: t.dce_url as string | undefined, source: "list_extract", data: t });
        }
      }
      stats.ids_from_list_extract = listRes.tenders.length;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[atexo] Firecrawl fallback failed: ${msg}`);
      if (allIds.size === 0) {
        return finalize(ctx, allIds, stats, calls, "error", "network_timeout", msg);
      }
    }
  }

  // ============== STEP 3 : pagination ==============
  if (stats.total_pages_detected <= 1) {
    stoppedBy = "single_page";
  } else if (ctx.mode === "FAST") {
    stoppedBy = "fast_mode";
  } else if (stats.engine === "prado_event_chain" && pradoState) {
    stoppedBy = await runPradoEventChain(
      ctx,
      pradoState,
      initialHtml,
      allIds,
      stats,
    );
  } else {
    // Fallback Firecrawl (legacy v3.3 click/input)
    stoppedBy = await runFirecrawlFallback(ctx, initialHtml, allIds, stats, () => calls++);
    calls = stats.actions_pages_scraped + 1; // approximation; calls counter already incremented
  }

  // ============== STEP 4 : enrichissement page DÉTAIL (HTTP brut, gratuit) ==============
  // C'est ici qu'on récupère titre / objet / buyer / deadline / référence publique.
  // La page liste Atexo ne les contient pas — il faut interroger /entreprise/consultation/{id}.
  // v3.9 — enrich detail pages for ALL Atexo engines (single_page, firecrawl
  // fallback, prado_event_chain). Previously gated on prado_event_chain only,
  // which left new hosts (e.g. marches.maximilien.fr) stuck on the placeholder
  // "Consultation Atexo {id}" until the manual backfill was clicked.
  if (allIds.size > 0) {
    const idsToEnrich: string[] = [];
    const isPlaceholderListTitle = (t: unknown): boolean => {
      if (!t) return true;
      const s = String(t).trim();
      if (!s) return true;
      if (/^Consultation Atexo \d+$/i.test(s)) return true;
      if (/^Acc[eé]der\s/i.test(s)) return true;          // "Accéder à la consultation"
      if (/^Consultation\s+\d+\s*$/i.test(s)) return true; // "Consultation 4", "Consultation 506296"
      if (s.length < 8) return true;                        // too short to be a real title
      return false;
    };
    for (const [id, c] of allIds) {
      if (!c.data || isPlaceholderListTitle(c.data.title)) {
        idsToEnrich.push(id);
      }
    }
    if (idsToEnrich.length > 0) {
      stats.details_attempted = idsToEnrich.length;
      const baseHost = baseHostUrl(ctx.url);
      console.log(`[atexo:detail] enriching ${idsToEnrich.length} consultation pages (pool=${DETAIL_POOL_SIZE})`);
      const remainingTime = Math.max(10_000, MAX_TOTAL_TIME_MS - (Date.now() - runStartTime) - 5_000);
      const budget = Math.min(DETAIL_BUDGET_MS, remainingTime);
      const cookies = pradoState?.cookies ?? "";
      const enrichRes = await enrichDetailsBatch(idsToEnrich, baseHost, cookies, {
        poolSize: DETAIL_POOL_SIZE,
        perFetchTimeoutMs: DETAIL_TIMEOUT_MS,
        globalBudgetMs: budget,
      });
      stats.details_fetched = enrichRes.fetched;
      stats.details_failed = enrichRes.failed;
      stats.details_time_ms = enrichRes.elapsedMs;
      stats.parser_match_rate = Math.round(enrichRes.matchRate * 100) / 100;
      // Merge enriched data back into allIds
      for (const [id, detail] of enrichRes.results) {
        const c = allIds.get(id);
        if (!c) continue;
        if (detail._matched_fields > 0) {
          // Discard the placeholder title from the list if the detail page didn't give us one.
          const safeTitle =
            detail.title ??
            (isPlaceholderListTitle(c.data?.title) ? `Consultation Atexo ${id}` : c.data?.title);
          c.data = {
            ...(c.data ?? {}),
            title: safeTitle,
            description: detail.object ?? c.data?.description,
            buyer_name: detail.buyer_name ?? c.data?.buyer_name,
            deadline: detail.deadline ?? c.data?.deadline,
            publication_date: detail.publication_date ?? c.data?.publication_date,
            reference: detail.reference ?? c.data?.reference,
            procedure_type: detail.procedure_type ?? c.data?.procedure_type,
            contract_type: detail.contract_type ?? c.data?.contract_type,
            cpv_codes: detail.cpv_codes ?? c.data?.cpv_codes,
            dce_url: detail.dce_url,
          };
          c.source = "prado_chain";
        } else {
          // Detail returned nothing useful — at least sanitize a bad placeholder title.
          if (c.data && isPlaceholderListTitle(c.data.title)) {
            c.data.title = `Consultation Atexo ${id}`;
          }
        }
      }
      console.log(
        `[atexo:detail] done: fetched=${enrichRes.fetched} failed=${enrichRes.failed} ` +
          `match_rate=${stats.parser_match_rate} elapsed=${enrichRes.elapsedMs}ms`,
      );
    }
  }

  stats.time_elapsed_ms = Date.now() - runStartTime;
  if (!stats.stop_reason_detail) {
    stats.stop_reason_detail = `${stoppedBy} (totalPages=${stats.total_pages_detected}, scraped=${1 + stats.actions_pages_scraped}, cap=${MAX_PAGES_PER_RUN})`;
  }

  return finalize(ctx, allIds, stats, calls + stats.actions_pages_scraped /* prado pages = HTTP, ~free */, stoppedBy);
}

// ============================================================================
//                       PRADO EVENT-CHAIN PAGINATION
// ============================================================================

async function runPradoEventChain(
  ctx: ExecutorContext,
  initialState: FormState,
  initialHtml: string,
  allIds: Map<string, ConsultationItem>,
  stats: AtexoStats,
): Promise<ExecutorResult["stopped_by"]> {
  let state = initialState;
  let lastHtml = initialHtml;
  let prevPageIds = new Set(extractIdsFromHtmlPrado(initialHtml));
  let prevFirstRow = firstRowFingerprint(initialHtml);
  const startTime = Date.now();

  const totalPages = stats.total_pages_detected;
  // Adaptive sweep: if totalPages fits in our cap, scrape everything.
  // Otherwise plafonne à MAX_PAGES_PER_RUN.
  const remainingPages = Math.max(0, totalPages - 1);
  const pagesToFetch = Math.min(remainingPages, MAX_PAGES_PER_RUN);
  stats.pages_planned = pagesToFetch;
  const fullSweep = pagesToFetch === remainingPages;
  console.log(
    `[atexo:prado] sweep plan: totalPages=${totalPages}, pagesToFetch=${pagesToFetch}, fullSweep=${fullSweep}, cap=${MAX_PAGES_PER_RUN}`,
  );

  let consecutiveHttpErrors = 0;

  for (let i = 0; i < pagesToFetch; i++) {
    if (Date.now() - startTime > MAX_TOTAL_TIME_MS) {
      console.warn(`[atexo:prado] global timeout after ${i} pages`);
      stats.stop_reason_detail = `time_budget exceeded after ${i} pages (${Date.now() - startTime}ms)`;
      return "budget";
    }

    const targetPageNumber = i + 2; // we already have page 1
    const eventTarget = extractNextPagerEventTarget(lastHtml);
    if (!eventTarget) {
      console.log(`[atexo:prado] no next-pager event target found on page ${i + 1} — end of pagination`);
      return "max_pages";
    }
    stats.event_targets_used.push(eventTarget);

    // Sanity check: pagestate must be present
    if (!state.pageState) {
      console.warn(`[atexo:prado] PRADO_PAGESTATE missing before page ${targetPageNumber} — abort`);
      stats.pagestate_lost = true;
      return "error";
    }

    const prevPageState = state.pageState;
    const prevCsrf = state.csrfToken;
    const prevCookies = state.cookies;

    let result;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_PER_POST_MS);
      result = await postEvent(state, eventTarget, "", ctrl.signal);
      clearTimeout(timer);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      consecutiveHttpErrors++;
      stats.consecutive_http_errors = consecutiveHttpErrors;
      console.warn(`[atexo:prado] POST page ${targetPageNumber} failed (${consecutiveHttpErrors}/2): ${msg}`);
      if (consecutiveHttpErrors >= 2) {
        stats.stop_reason_detail = `2 consecutive POST failures: ${msg}`;
        return "error";
      }
      continue;
    }

    stats.http_status_per_page.push(result.status);
    if (result.status >= 400) {
      consecutiveHttpErrors++;
      stats.consecutive_http_errors = consecutiveHttpErrors;
      console.warn(`[atexo:prado] HTTP ${result.status} on page ${targetPageNumber} (${consecutiveHttpErrors}/2)`);
      if (consecutiveHttpErrors >= 2) {
        stats.stop_reason_detail = `2 consecutive HTTP errors (last=${result.status})`;
        return "error";
      }
      continue;
    }
    consecutiveHttpErrors = 0;

    // STATE CHAINING — adopt the new state for the next iteration
    state = result.state;
    lastHtml = result.html;
    stats.actions_pages_scraped++;

    if (state.pageState && state.pageState !== prevPageState) stats.pagestate_rotations++;
    else if (!state.pageState) {
      stats.pagestate_lost = true;
      console.warn(`[atexo:prado] pagestate lost in response of page ${targetPageNumber} — abort`);
      return "error";
    }
    if (state.csrfToken && state.csrfToken !== prevCsrf) stats.csrf_rotations++;
    if (state.cookies && state.cookies !== prevCookies) stats.cookies_rotations++;

    // Extract IDs + fingerprint
    const pageIds = extractIdsFromHtmlPrado(lastHtml);
    const pageIdSet = new Set(pageIds);
    const pageFirstRow = firstRowFingerprint(lastHtml);
    const reportedCurrent = extractCurrentPage(lastHtml);

    // DOM stuck detection: same IDs AND same first row as previous
    const sameIds =
      pageIds.length > 0 &&
      pageIds.length === prevPageIds.size &&
      pageIds.every((id) => prevPageIds.has(id));
    const sameFirstRow = pageFirstRow !== "" && pageFirstRow === prevFirstRow;

    if (sameIds && sameFirstRow) {
      stats.dom_stuck_detected = true;
      console.warn(
        `[atexo:prado] page ${targetPageNumber} fingerprint identical to previous (reportedCurrent=${reportedCurrent}) — stop`,
      );
      return "no_new_items";
    }

    const beforeCount = allIds.size;
    for (const id of pageIds) {
      if (!allIds.has(id)) {
        allIds.set(id, {
          id,
          url: `${baseHostUrl(ctx.url)}/entreprise/consultation/${id}`,
          source: "prado_chain",
        });
      }
    }
    const newOnThisPage = allIds.size - beforeCount;
    stats.items_per_page_actual.push(pageIds.length);
    stats.ids_from_actions += newOnThisPage;

    console.log(
      `[atexo:prado] page ${targetPageNumber} (reported=${reportedCurrent}): ${pageIds.length} IDs, +${newOnThisPage} new, status=${result.status}`,
    );

    prevPageIds = pageIdSet;
    prevFirstRow = pageFirstRow;

    if (newOnThisPage === 0) {
      console.log(`[atexo:prado] no new IDs on page ${targetPageNumber} — stop`);
      return "no_new_items";
    }
  }

  // Finished the planned loop without early-exit
  if (fullSweep) {
    stats.stop_reason_detail = `full sweep completed: ${pagesToFetch + 1} pages drained (totalPages=${totalPages})`;
  } else {
    stats.stop_reason_detail = `cap reached: scraped ${pagesToFetch + 1}/${totalPages} pages (cap=${MAX_PAGES_PER_RUN})`;
  }
  return "max_pages";
}

/** Build a fingerprint of the first row of the result table (for stuck detection). */
function firstRowFingerprint(html: string): string {
  const m = html.match(/\/entreprise\/consultation\/(\d+)[\s\S]{0,400}/);
  if (!m) return "";
  return m[0].replace(/\s+/g, " ").slice(0, 200);
}

// ============================================================================
//                       FIRECRAWL FALLBACK (legacy v3.3)
// ============================================================================

const PAGE_INPUT_SELECTOR = "input[name*='numPageBottom'], input[id*='numPageBottom']";
const NEXT_PAGE_SELECTORS = [
  "a[id*='PagerBottom_ctl2']",
  "a[id*='PagerBottom_ctl3']",
  "a[title*='page suivante' i]",
  "a:has(span[title*='page suivante' i])",
].join(", ");

function buildInputDrivenActions(targetPage: number): FirecrawlAction[] {
  return [
    { type: "wait", milliseconds: 1200 },
    { type: "click", selector: PAGE_INPUT_SELECTOR },
    { type: "press", key: "Backspace" },
    { type: "press", key: "Backspace" },
    { type: "press", key: "Backspace" },
    { type: "write", text: String(targetPage) },
    { type: "wait", milliseconds: 300 },
    { type: "press", key: "Enter" },
    { type: "wait", milliseconds: 3000 },
    { type: "scrape" },
  ];
}

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

async function runFirecrawlFallback(
  ctx: ExecutorContext,
  _initialHtml: string,
  allIds: Map<string, ConsultationItem>,
  stats: AtexoStats,
  bumpCalls: () => void,
): Promise<ExecutorResult["stopped_by"]> {
  let calls = 1; // page 1 already counted by caller
  let stoppedBy: ExecutorResult["stopped_by"] = "max_pages";
  const pagesToFetch = Math.min(stats.total_pages_detected - 1, MAX_ACTION_PAGES_FC);
  let consecutiveNoNew = 0;
  let useClickFallback = false;
  let prevPageIds = new Set(Array.from(allIds.keys()));

  for (let pageOffset = 0; pageOffset < pagesToFetch; pageOffset++) {
    if (calls >= MAX_CALLS_PER_URL_FC) {
      stoppedBy = "budget";
      break;
    }
    const targetPage = pageOffset + 2;
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
      bumpCalls();
      stats.actions_pages_scraped++;
      stats.pagination_mode = useClickFallback ? "click_fallback" : "input";

      const pageIds = extractIdsFromHtml(actionRes.raw_html);
      const pageIdSet = new Set(pageIds);
      const sameAsPrev =
        pageIds.length > 0 &&
        pageIds.length === prevPageIds.size &&
        pageIds.every((id) => prevPageIds.has(id));
      if (sameAsPrev) {
        stats.dom_stuck_detected = true;
        if (!useClickFallback) {
          useClickFallback = true;
          pageOffset--;
          continue;
        }
        stoppedBy = "no_new_items";
        break;
      }
      const before = allIds.size;
      for (const id of pageIds) {
        if (!allIds.has(id)) {
          allIds.set(id, {
            id,
            url: `${baseHostUrl(ctx.url)}/entreprise/consultation/${id}`,
            source: "actions",
          });
        }
      }
      for (const t of actionRes.tenders) {
        const id = extractConsultationId(t.dce_url as string | undefined);
        if (id) {
          const existing = allIds.get(id);
          if (existing && !existing.data) existing.data = t;
        }
      }
      const newOnThisPage = allIds.size - before;
      stats.items_per_page_actual.push(pageIds.length);
      stats.ids_from_actions += newOnThisPage;
      prevPageIds = pageIdSet;
      if (newOnThisPage === 0) {
        consecutiveNoNew++;
        if (consecutiveNoNew >= 2) {
          stoppedBy = "no_new_items";
          break;
        }
      } else consecutiveNoNew = 0;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[atexo:fc] page ${targetPage} failed: ${msg}`);
      if (!useClickFallback && /element not found|selector/i.test(msg)) {
        useClickFallback = true;
        pageOffset--;
        continue;
      }
      break;
    }
  }
  return stoppedBy;
}

// ============================================================================
//                              FINALIZE
// ============================================================================

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

  const baseHost = baseHostUrl(ctx.url);
  const items: Array<Record<string, unknown>> = [];
  for (const c of allIds.values()) {
    const dceUrl =
      (c.data?.dce_url as string | undefined) ||
      c.url ||
      `${baseHost}/entreprise/consultation/${c.id}`;
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

  // Best-effort: persist the detected engine in the playbook config
  if (stats.engine === "prado_event_chain") {
    try {
      const { data: pb } = await ctx.supabase
        .from("agent_playbooks")
        .select("id, config")
        .eq("sourcing_url_id", ctx.sourcing_url_id)
        .maybeSingle();
      if (pb?.id) {
        const newConfig = { ...(pb.config ?? {}), pagination_engine: "prado_event_chain" };
        await ctx.supabase
          .from("agent_playbooks")
          .update({ config: newConfig })
          .eq("id", pb.id);
      }
    } catch (e) {
      console.warn(`[atexo] failed to persist pagination_engine: ${e}`);
    }
  }

  console.log(
    `[atexo] DONE engine=${stats.engine} unique=${allIds.size} new=${newCount} ` +
      `pages=${1 + stats.actions_pages_scraped} pagestate_rot=${stats.pagestate_rotations} ` +
      `coverage=${stats.coverage_ratio} stopped=${stoppedBy}`,
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
