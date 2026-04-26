// atexo-backfill
// One-shot retro-enrichment of Atexo consultations stored with placeholder
// titles ("Consultation Atexo {id}") and missing buyer/deadline.
// Fetches the /entreprise/consultation/{id} detail page for each one,
// parses metadata and UPDATEs the tenders row.
//
// Designed to be invoked repeatedly from the admin UI until `remaining === 0`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { fetchAtexoDetail, type AtexoDetail } from "../_shared/atexoDetailParser.ts";

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

type TenderRow = {
  id: string;
  title: string | null;
  buyer_name: string | null;
  deadline: string | null;
  source_url: string | null;
  enriched_data: Record<string, unknown> | null;
};

/** Parse https://host/entreprise/consultation/{id} → { host, id }. */
function parseDetailUrl(url: string): { host: string; id: string } | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/entreprise\/consultation\/(\d+)/);
    if (!m) return null;
    return { host: `${u.protocol}//${u.host}`, id: m[1] };
  } catch {
    return null;
  }
}

/** Seed a PHPSESSID by hitting the host root. */
async function seedSession(host: string, signal?: AbortSignal): Promise<string> {
  try {
    const res = await fetch(host, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "fr-FR,fr;q=0.9",
      },
      redirect: "follow",
      signal,
    });
    const cookies: string[] = [];
    // deno-lint-ignore no-explicit-any
    const setCookies = (res.headers as any).getSetCookie?.() ?? [];
    for (const sc of setCookies) {
      const kv = sc.split(";")[0];
      if (kv) cookies.push(kv);
    }
    return cookies.join("; ");
  } catch {
    return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: { batchSize?: number; dryRun?: boolean } = {};
  try {
    body = await req.json();
  } catch { /* no-op */ }
  const batchSize = Math.min(Math.max(body.batchSize ?? 80, 1), 200);
  const dryRun = body.dryRun === true;

  const t0 = Date.now();
  const BUDGET_MS = 50_000;

  // Items to enrich = any Atexo consultation with placeholder/poor metadata.
  // We cover 5 placeholder families:
  //   - "Consultation Atexo {id}"   (v3.5+ uniform placeholder)
  //   - "Consultation {n}"          (legacy: "Consultation 4", "Consultation 506296")
  //   - "Accéder à la consultation" / "Acceder..." (list-page action label)
  //   - empty/null title
  //   - poor buyer_name ("Organisme Public", "Non spécifié", null) or null deadline
  // Note: title.ilike.Consultation% would catch real titles ("Consultation pour..."),
  // so we use a regex (imatch) anchored on the placeholder shape.
  const orFilter = [
    "title.ilike.Consultation Atexo%",
    "title.ilike.Accéder à la consultation%",
    "title.ilike.Acceder à la consultation%",
    "title.imatch.^Consultation [0-9]+$",
    "title.is.null",
    "buyer_name.is.null",
    "buyer_name.in.(\"Organisme Public\",\"Non spécifié\",\"\")",
    "deadline.is.null",
  ].join(",");

  const { count: remainingBefore } = await supabase
    .from("tenders")
    .select("id", { count: "exact", head: true })
    .like("source_url", "%/entreprise/consultation/%")
    .or(orFilter);

  const { data: rows, error } = await supabase
    .from("tenders")
    .select("id,title,buyer_name,deadline,source_url,enriched_data")
    .like("source_url", "%/entreprise/consultation/%")
    .or(orFilter)
    .order("created_at", { ascending: false })
    .limit(batchSize);

  if (error) {
    console.error("[atexo:backfill] select error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const items = (rows ?? []) as TenderRow[];
  if (items.length === 0) {
    return new Response(
      JSON.stringify({
        processed: 0,
        updated: 0,
        failed: 0,
        remaining: 0,
        elapsed_ms: Date.now() - t0,
        message: "Nothing to backfill",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 2. Group by host (so we seed a session once per host)
  const byHost = new Map<string, { tender: TenderRow; id: string }[]>();
  let skipped = 0;
  for (const t of items) {
    const parsed = t.source_url ? parseDetailUrl(t.source_url) : null;
    if (!parsed) { skipped++; continue; }
    const arr = byHost.get(parsed.host) ?? [];
    arr.push({ tender: t, id: parsed.id });
    byHost.set(parsed.host, arr);
  }

  let processed = 0;
  let updated = 0;
  let failed = 0;
  const POOL = 6;
  const PER_FETCH_TIMEOUT_MS = 8_000;

  const updateOne = async (tender: TenderRow, detail: AtexoDetail) => {
    const patch: Record<string, unknown> = {};
    if (detail.title && (!tender.title || tender.title.startsWith("Consultation Atexo"))) {
      patch.title = detail.title;
    }
    if (detail.object) patch.object = detail.object;
    if (detail.buyer_name && !tender.buyer_name) patch.buyer_name = detail.buyer_name;
    if (detail.reference) patch.reference = detail.reference;
    if (detail.deadline && !tender.deadline && detail.deadline.includes("T")) {
      patch.deadline = detail.deadline;
    }
    if (detail.publication_date) patch.publication_date = detail.publication_date;
    if (detail.cpv_codes && detail.cpv_codes.length > 0) patch.cpv_codes = detail.cpv_codes;
    if (detail.procedure_type) patch.procedure_type = detail.procedure_type;
    if (detail.contract_type) patch.contract_type = detail.contract_type;

    const enriched = {
      ...(tender.enriched_data ?? {}),
      backfilled_at: new Date().toISOString(),
      backfill_match_count: detail._matched_fields,
      backfill_status: detail._detail_status,
    };
    patch.enriched_data = enriched;

    if (Object.keys(patch).length <= 1) return false; // only enriched_data, nothing real
    if (dryRun) return true;

    const { error: upErr } = await supabase
      .from("tenders")
      .update(patch)
      .eq("id", tender.id);
    if (upErr) {
      console.error(`[atexo:backfill] update fail ${tender.id}:`, upErr.message);
      return false;
    }
    return true;
  };

  // 3. Process per host, with concurrency pool, respecting global budget
  for (const [host, list] of byHost) {
    if (Date.now() - t0 > BUDGET_MS) break;

    const cookies = await seedSession(host);
    const queue = [...list];

    const worker = async () => {
      while (queue.length > 0) {
        if (Date.now() - t0 > BUDGET_MS) return;
        const item = queue.shift();
        if (!item) return;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), PER_FETCH_TIMEOUT_MS);
        try {
          const detail = await fetchAtexoDetail(item.id, host, cookies, ctrl.signal);
          clearTimeout(timer);
          processed++;
          if (detail._matched_fields >= 2) {
            const ok = await updateOne(item.tender, detail);
            if (ok) updated++;
            else failed++;
          } else {
            failed++;
          }
        } catch (e) {
          clearTimeout(timer);
          processed++;
          failed++;
          console.warn(`[atexo:backfill] fetch fail ${item.id}: ${(e as Error).message}`);
        }
      }
    };

    await Promise.all(Array.from({ length: POOL }, () => worker()));
    console.log(
      `[atexo:backfill] host=${host} done processed=${processed} updated=${updated} failed=${failed} elapsed=${Date.now() - t0}ms`,
    );
  }

  // Recompute remaining
  const { count: remainingAfter } = await supabase
    .from("tenders")
    .select("id", { count: "exact", head: true })
    .like("source_url", "%/entreprise/consultation/%")
    .or("title.like.Consultation Atexo%,buyer_name.is.null,deadline.is.null");

  // Log to scrape_logs for traceability
  if (!dryRun) {
    await supabase.from("scrape_logs").insert({
      source: "atexo_backfill",
      status: "ok",
      items_found: processed,
      items_updated: updated,
      items_skipped: failed + skipped,
      finished_at: new Date().toISOString(),
      metadata: {
        batch_size: batchSize,
        hosts: Array.from(byHost.keys()),
        remaining_before: remainingBefore,
        remaining_after: remainingAfter,
        elapsed_ms: Date.now() - t0,
      },
    });
  }

  return new Response(
    JSON.stringify({
      processed,
      updated,
      failed,
      skipped,
      remaining: remainingAfter ?? 0,
      remaining_before: remainingBefore ?? 0,
      hosts: Array.from(byHost.keys()),
      elapsed_ms: Date.now() - t0,
      dry_run: dryRun,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
