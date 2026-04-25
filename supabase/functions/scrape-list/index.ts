// scrape-list v3 — orchestre playbook → executor → fallback v2 → log enrichi.
// Le code applique TOUTES les stop rules. L'IA n'intervient pas ici.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/cors.ts";
import { detectPlatformFromUrl } from "../_shared/normalize.ts";
import { execute, type ScrapeMode, type Playbook } from "../_shared/playbookExecutor.ts";

const HEALABLE_ERRORS = new Set([
  "selector_not_found",
  "pagination_broken",
  "list_empty_with_data_in_dom",
]);
const FAIL_THRESHOLD = 2;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) return json({ error: "FIRECRAWL_API_KEY missing" }, 500);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const { sourcing_url_id, dry_run = false, mode: modeOverride } = body;
    if (!sourcing_url_id) return json({ error: "sourcing_url_id required" }, 400);

    const { data: src, error: srcErr } = await supabase
      .from("sourcing_urls")
      .select("*")
      .eq("id", sourcing_url_id)
      .maybeSingle();
    if (srcErr || !src) return json({ error: "sourcing_url not found" }, 404);

    const startedAt = new Date().toISOString();
    const platform = detectPlatformFromUrl(src.url);
    if (platform !== src.platform) {
      console.log(`[scrape-list] platform corrigé pour ${src.url}: ${src.platform} → ${platform}`);
    }

    // Charge le playbook actif (s'il existe)
    const { data: pbRow } = await supabase
      .from("agent_playbooks")
      .select("*")
      .eq("sourcing_url_id", sourcing_url_id)
      .eq("is_active", true)
      .maybeSingle();

    const playbook: Playbook | null = pbRow
      ? {
          id: pbRow.id,
          sourcing_url_id: pbRow.sourcing_url_id,
          list_strategy: pbRow.list_strategy,
          pagination_hint: pbRow.pagination_hint,
          confidence: Number(pbRow.confidence ?? 0),
          pagination: pbRow.config?.pagination,
          selectors: pbRow.config?.selectors,
        }
      : null;

    // Détermine le mode (override du body > metadata > SMART par défaut)
    const mode: ScrapeMode = (modeOverride ?? src.metadata?.scrape_mode ?? "SMART") as ScrapeMode;

    // Skip si confidence trop basse et pas de fallback codé
    if (playbook && playbook.confidence < 0.5 && playbook.list_strategy === "manual") {
      return json({
        ok: false,
        skipped: true,
        reason: "playbook_requires_manual_review",
        confidence: playbook.confidence,
      });
    }

    // Exécute
    const result = await execute({
      url: src.url,
      platform,
      mode,
      playbook,
      apiKey: FIRECRAWL_API_KEY,
      supabase,
      sourcing_url_id,
    });

    // Annote items avec metadata
    const enriched = result.items.map((it) => ({
      ...it,
      _platform: platform,
      _source_url: src.url,
      _sourcing_url_id: src.id,
    }));

    if (dry_run) {
      return json({
        ok: !result.error_type,
        platform,
        items_found: enriched.length,
        items: enriched.slice(0, 50),
        metrics: result,
      });
    }

    // Forward to upsert-tenders
    let inserted = 0,
      updated = 0,
      skipped = 0;
    if (enriched.length > 0) {
      const upsertResp = await fetch(`${SUPABASE_URL}/functions/v1/upsert-tenders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ items: enriched, source: `scrape:${platform}` }),
      });
      const upsertResult = await upsertResp.json().catch(() => ({}));
      inserted = upsertResult.inserted ?? 0;
      updated = upsertResult.updated ?? 0;
      skipped = upsertResult.skipped ?? 0;
    }

    const finishedAt = new Date().toISOString();
    const status = result.error_type ? "failed" : "success";

    await supabase.from("scrape_logs").insert({
      source: `scrape:${platform}`,
      status,
      started_at: startedAt,
      finished_at: finishedAt,
      items_found: enriched.length,
      items_inserted: inserted,
      items_updated: updated,
      items_skipped: skipped,
      errors: result.error_message ?? null,
      sourcing_url_id: src.id,
      metadata: {
        url: src.url,
        platform,
        mode,
        strategy: result.strategy_used,
        pages_scraped: result.pages_scraped,
        calls_firecrawl: result.calls_firecrawl,
        items_raw: result.items_raw,
        items_after_dedup: result.items_after_dedup,
        items_new_vs_seen_cache: result.items_new_vs_seen_cache,
        stopped_by: result.stopped_by,
        error_type: result.error_type,
        playbook_version: pbRow?.version,
        playbook_confidence: pbRow?.confidence,
      },
    });

    await supabase
      .from("sourcing_urls")
      .update({
        last_run_at: finishedAt,
        last_status: status,
        last_items_found: enriched.length,
        last_items_inserted: inserted,
        last_error: result.error_message ?? null,
      })
      .eq("id", src.id);

    // Met à jour fail_count + last_error_type sur le playbook
    if (pbRow) {
      const updates: Record<string, unknown> = result.error_type
        ? { fail_count: (pbRow.fail_count ?? 0) + 1, last_error_type: result.error_type }
        : { fail_count: 0, last_error_type: null, last_validated_at: finishedAt };
      await supabase.from("agent_playbooks").update(updates).eq("id", pbRow.id);

      // Auto-trigger Healer si seuil atteint sur erreur structurelle
      const newFailCount = result.error_type ? (pbRow.fail_count ?? 0) + 1 : 0;
      if (
        newFailCount >= FAIL_THRESHOLD &&
        result.error_type &&
        HEALABLE_ERRORS.has(result.error_type)
      ) {
        console.log(`[scrape-list] triggering Healer for ${src.id} (${result.error_type})`);
        // Fire-and-forget : on n'attend pas
        fetch(`${SUPABASE_URL}/functions/v1/heal-playbook`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sourcing_url_id: src.id }),
        }).catch((e) => console.error("[scrape-list] heal trigger failed:", e));
      }
    }

    return json({
      ok: !result.error_type,
      platform,
      mode,
      items_found: enriched.length,
      inserted,
      updated,
      skipped,
      strategy: result.strategy_used,
      pages_scraped: result.pages_scraped,
      calls_firecrawl: result.calls_firecrawl,
      stopped_by: result.stopped_by,
      error_type: result.error_type,
      error: result.error_message,
    });
  } catch (e) {
    console.error("scrape-list error:", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
