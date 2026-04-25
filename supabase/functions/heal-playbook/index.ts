// heal-playbook : déclenché quand un playbook a échoué N fois sur des erreurs STRUCTURELLES.
// Re-appelle scout-playbook pour générer une nouvelle version. Pas d'IA ici, juste l'orchestration.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/cors.ts";

const HEALABLE_ERRORS = new Set([
  "selector_not_found",
  "pagination_broken",
  "list_empty_with_data_in_dom",
]);
const FAIL_THRESHOLD = 2;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const { sourcing_url_id, force = false } = body;
    if (!sourcing_url_id) return json({ error: "sourcing_url_id required" }, 400);

    // Vérifie l'éligibilité (sauf si force=true)
    if (!force) {
      const { data: pb } = await supabase
        .from("agent_playbooks")
        .select("fail_count, last_error_type")
        .eq("sourcing_url_id", sourcing_url_id)
        .eq("is_active", true)
        .maybeSingle();

      if (!pb) {
        return json({ ok: false, skipped: true, reason: "no_active_playbook" });
      }
      if ((pb.fail_count ?? 0) < FAIL_THRESHOLD) {
        return json({ ok: false, skipped: true, reason: "fail_count_below_threshold", fail_count: pb.fail_count });
      }
      if (!HEALABLE_ERRORS.has(pb.last_error_type ?? "")) {
        return json({
          ok: false,
          skipped: true,
          reason: "error_not_structural",
          last_error_type: pb.last_error_type,
        });
      }
    }

    // Délègue à scout-playbook
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/scout-playbook`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sourcing_url_id, reason: "healer" }),
    });

    const result = await resp.json().catch(() => ({}));
    return json({ ok: resp.ok, healed: resp.ok, scout_result: result }, resp.ok ? 200 : 500);
  } catch (e) {
    console.error("heal-playbook error:", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
