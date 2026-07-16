import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Passe en `closed` tout tender encore "open" dont la deadline est dépassée (>24h).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cutoff = new Date(Date.now() - 86400000).toISOString();
  const startedAt = new Date().toISOString();

  // Pas de limite batch côté SDK : un UPDATE serveur unique.
  const { data, error, count } = await supabase
    .from("tenders")
    .update({ status: "closed" }, { count: "exact" })
    .eq("status", "open")
    .lt("deadline", cutoff)
    .select("id", { count: "exact", head: true });

  if (error) {
    console.error("close-expired-tenders error", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const closed = count ?? data?.length ?? 0;
  console.log(`close-expired-tenders: closed=${closed} cutoff=${cutoff}`);

  return new Response(JSON.stringify({ ok: true, closed, cutoff, startedAt }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
