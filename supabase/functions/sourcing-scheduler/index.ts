// sourcing-scheduler : sélectionne les URLs dues, lance scrape-list en parallèle (concurrence limitée)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/cors.ts";

const CONCURRENCY = 3;

async function runWithLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<any>) {
  const results: any[] = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        results[idx] = await fn(items[idx]);
      } catch (e) {
        results[idx] = { error: e instanceof Error ? e.message : String(e) };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const force: boolean = body.force === true;
    const onlyId: string | undefined = body.sourcing_url_id;

    let query = supabase.from("sourcing_urls").select("*").eq("is_active", true);
    if (onlyId) query = query.eq("id", onlyId);
    const { data: urls, error } = await query;
    if (error) return json({ error: error.message }, 500);
    if (!urls || urls.length === 0) return json({ ok: true, ran: 0 });

    const now = Date.now();
    const due = force
      ? urls
      : urls.filter((u) => {
          if (!u.last_run_at) return true;
          const last = new Date(u.last_run_at).getTime();
          const intervalMs = (u.frequency_hours ?? 6) * 3600 * 1000;
          return now - last >= intervalMs;
        });

    if (due.length === 0) return json({ ok: true, ran: 0, total: urls.length });

    const results = await runWithLimit(due, CONCURRENCY, async (u) => {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/scrape-list`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sourcing_url_id: u.id }),
      });
      const r = await resp.json().catch(() => ({}));
      return { id: u.id, url: u.url, ...r };
    });

    return json({ ok: true, ran: due.length, total: urls.length, results });
  } catch (e) {
    console.error("sourcing-scheduler error:", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
