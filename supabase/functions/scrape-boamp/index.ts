import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// BOAMP uses Opendatasoft API v2.1
const BOAMP_API_BASE = "https://www.boamp.fr/api/explore/v2.1/catalog/datasets/boamp/records";

function normalizeBoampToTender(record: any) {
  const r = record; // each record is a flat object from ODS API
  return {
    title: r.objet || r.idweb || "Sans titre",
    reference: r.idweb,
    source: "boamp",
    source_url: r.url_avis || `https://www.boamp.fr/pages/avis/?q=idweb:${r.idweb}`,
    buyer_name: r.nomacheteur || null,
    buyer_siret: null, // SIRET is nested in donnees JSON, not top-level
    object: r.objet || null,
    procedure_type: r.procedure_libelle || r.type_procedure || null,
    department: Array.isArray(r.code_departement) ? r.code_departement[0] : r.code_departement || null,
    region: null,
    publication_date: r.dateparution || null,
    deadline: r.datelimitereponse || null,
    estimated_amount: null,
    cpv_codes: r.descripteur_code || [],
    lots: [],
    status: "open" as const,
    updated_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const logId = crypto.randomUUID();
  let itemsFound = 0;
  let itemsInserted = 0;
  const errors: string[] = [];

  try {
    await supabase.from("scrape_logs").insert({
      id: logId,
      source: "boamp",
      status: "running",
    });

    // Fetch notices published yesterday or today
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0];

    // ODS API: filter by dateparution, paginate with offset
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({
        where: `dateparution >= '${dateStr}'`,
        order_by: "dateparution desc",
        limit: limit.toString(),
        offset: offset.toString(),
      });

      const url = `${BOAMP_API_BASE}?${params}`;
      console.log(`[scrape-boamp] Fetching: ${url}`);

      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`BOAMP API returned ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      const results = data.results || [];
      const totalCount = data.total_count || 0;

      if (offset === 0) {
        itemsFound = totalCount;
        console.log(`[scrape-boamp] Total notices: ${totalCount}`);
      }

      if (results.length === 0) {
        hasMore = false;
        break;
      }

      // Separate regular notices from attribution notices
      const tendersToUpsert: any[] = [];
      const attributions: any[] = [];

      for (const record of results) {
        const nature = (record.nature || "").toUpperCase();
        if (nature === "ATTRIBUTION" || nature === "RESULTAT") {
          attributions.push(record);
        } else {
          tendersToUpsert.push(normalizeBoampToTender(record));
        }
      }

      // Upsert tenders
      if (tendersToUpsert.length > 0) {
        const { data: upserted, error } = await supabase
          .from("tenders")
          .upsert(tendersToUpsert, {
            onConflict: "reference,source",
            ignoreDuplicates: false,
          })
          .select("id");

        if (error) {
          console.error("[scrape-boamp] Upsert error:", error.message);
          errors.push(`Upsert offset ${offset}: ${error.message}`);
        } else {
          itemsInserted += upserted?.length || 0;
        }
      }

      // Process attributions - link to parent tender
      for (const record of attributions) {
        const parentRef = Array.isArray(record.annonce_lie) ? record.annonce_lie[0] : null;
        if (!parentRef) continue;

        const { data: matchingTender } = await supabase
          .from("tenders")
          .select("id")
          .eq("reference", parentRef)
          .eq("source", "boamp")
          .maybeSingle();

        if (matchingTender) {
          await supabase.from("award_notices").upsert({
            tender_id: matchingTender.id,
            winner_name: record.titulaire || null,
            award_date: record.dateparution || null,
          }, { onConflict: "tender_id" });

          await supabase
            .from("tenders")
            .update({ status: "awarded" })
            .eq("id", matchingTender.id);
        }
      }

      offset += limit;
      hasMore = offset < totalCount && offset < 1000; // Cap at 1000 per run
    }

    await supabase
      .from("scrape_logs")
      .update({
        finished_at: new Date().toISOString(),
        items_found: itemsFound,
        items_inserted: itemsInserted,
        errors: errors.length > 0 ? errors.join("; ") : null,
        status: errors.length > 0 ? "completed_with_errors" : "completed",
      })
      .eq("id", logId);

    return new Response(
      JSON.stringify({ success: true, items_found: itemsFound, items_inserted: itemsInserted, errors: errors.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[scrape-boamp] Fatal error:", err);
    await supabase.from("scrape_logs").update({
      finished_at: new Date().toISOString(),
      items_found: itemsFound,
      items_inserted: itemsInserted,
      errors: err.message,
      status: "failed",
    }).eq("id", logId);

    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
