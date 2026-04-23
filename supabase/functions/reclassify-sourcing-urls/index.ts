import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/cors.ts";
import { resolvePlatform } from "../_shared/normalize.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth: require admin caller
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "missing token" }, 401);

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "invalid token" }, 401);

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "admin only" }, 403);

    let body: { sourcing_url_id?: string; only_custom?: boolean } = {};
    try { body = await req.json(); } catch { /* allow empty */ }

    let query = supabase.from("sourcing_urls").select("id, url, platform, metadata");
    if (body.sourcing_url_id) {
      query = query.eq("id", body.sourcing_url_id);
    } else if (body.only_custom) {
      query = query.in("platform", ["custom", "safetender"]);
    }

    const { data: rows, error } = await query;
    if (error) return json({ error: error.message }, 500);

    const results: Array<{
      id: string; url: string; before: string; after: string;
      evidence: string[]; source: string; confidence: number; pagination_hint?: string;
    }> = [];
    const bySource: Record<string, number> = {};

    for (const row of rows ?? []) {
      // force: true bypass le cache pour vraiment relancer l'IA
      const resolved = await resolvePlatform(row.url, supabase, { force: true });
      const newMetadata = {
        ...(typeof row.metadata === "object" && row.metadata !== null ? row.metadata : {}),
        platform_evidence: resolved.evidence,
        platform_source: resolved.source,
        platform_confidence: resolved.confidence,
        platform_detected_at: new Date().toISOString(),
        ...(resolved.pagination_hint ? { pagination_hint: resolved.pagination_hint } : {}),
      };
      await supabase
        .from("sourcing_urls")
        .update({ platform: resolved.platform, metadata: newMetadata })
        .eq("id", row.id);

      bySource[resolved.source] = (bySource[resolved.source] ?? 0) + 1;
      results.push({
        id: row.id,
        url: row.url,
        before: row.platform,
        after: resolved.platform,
        evidence: resolved.evidence,
        source: resolved.source,
        confidence: resolved.confidence,
        pagination_hint: resolved.pagination_hint,
      });
    }

    return json({ ok: true, processed: results.length, by_source: bySource, results });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
