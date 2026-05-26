// Background re-scrape orchestrator: loops over sourcing_urls and invokes
// scrape-list for each, keeping the run alive via EdgeRuntime.waitUntil so it
// continues even after the client closes the page.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CONCURRENCY = 2;

async function runJob(jobId: string, urls: { id: string; url: string; platform: string }[]) {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  let done = 0, found = 0, inserted = 0, updated = 0, errors = 0;
  let cursor = 0;

  const worker = async () => {
    while (cursor < urls.length) {
      const idx = cursor++;
      const row = urls[idx];
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/scrape-list`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE}`,
            apikey: ANON_KEY,
          },
          body: JSON.stringify({ sourcing_url_id: row.id }),
        });
        if (!resp.ok) {
          errors++;
        } else {
          const data = await resp.json().catch(() => ({}));
          found += data?.items_found ?? 0;
          inserted += data?.inserted ?? 0;
          updated += data?.updated ?? 0;
        }
      } catch (e) {
        console.error("scrape-list failed", row.id, e);
        errors++;
      }
      done++;
      await admin
        .from("rescrape_jobs")
        .update({ done, found, inserted, updated, errors, last_url: row.url })
        .eq("id", jobId);
    }
  };

  try {
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker),
    );
    await admin
      .from("rescrape_jobs")
      .update({ status: "done", finished_at: new Date().toISOString() })
      .eq("id", jobId);
  } catch (e: any) {
    console.error("rescrape job failed", e);
    await admin
      .from("rescrape_jobs")
      .update({
        status: "failed",
        error_message: e?.message ?? String(e),
        finished_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const scope = body?.scope ?? "all"; // "all" | { platform: string }

    let q = admin
      .from("sourcing_urls")
      .select("id, url, platform")
      .eq("is_active", true);
    if (scope && typeof scope === "object" && scope.platform) {
      q = q.eq("platform", scope.platform);
    }
    const { data: urls, error: urlErr } = await q;
    if (urlErr) throw urlErr;
    if (!urls || urls.length === 0) {
      return new Response(JSON.stringify({ error: "No active URLs for scope" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: job, error: jobErr } = await admin
      .from("rescrape_jobs")
      .insert({
        created_by: userId,
        scope: typeof scope === "string" ? { kind: scope } : scope,
        status: "running",
        total: urls.length,
      })
      .select("id")
      .single();
    if (jobErr || !job) throw jobErr ?? new Error("Failed to create job");

    // Keep the worker alive even after we return.
    // @ts-ignore EdgeRuntime is provided by Supabase Deno runtime
    EdgeRuntime.waitUntil(runJob(job.id, urls));

    return new Response(
      JSON.stringify({ job_id: job.id, total: urls.length }),
      {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e: any) {
    console.error("rescrape-batch error", e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
