import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BOAMP_API_BASE = "https://api.boamp.fr/avis";

interface BoampAvis {
  id: string;
  idweb: string;
  dateparution: string;
  datemiseenligne: string;
  nomacheteur: string;
  siretacheteur: string;
  objet: string;
  typeamarche: string;
  typeprocedure: string;
  departement: string;
  region: string;
  datelimitereponse: string;
  montant: number | null;
  urlavis: string;
  reference: string;
  cpv: string[];
  lots: any[];
  nature: string; // "INITIAL", "ATTRIBUTION", "RECTIFICATIF"
}

function normalizeBoampToTender(avis: any) {
  return {
    title: avis.objet || avis.idweb || "Sans titre",
    reference: avis.idweb || avis.id?.toString(),
    source: "boamp",
    source_url: avis.urlavis || `https://www.boamp.fr/avis/detail/${avis.idweb}`,
    buyer_name: avis.nomacheteur || null,
    buyer_siret: avis.siretacheteur || null,
    object: avis.objet || null,
    procedure_type: avis.typeprocedure || null,
    department: avis.departement || null,
    region: avis.region || null,
    publication_date: avis.dateparution || avis.datemiseenligne || null,
    deadline: avis.datelimitereponse || null,
    estimated_amount: avis.montant || null,
    cpv_codes: avis.cpv || [],
    lots: avis.lots || [],
    status: "open" as const,
    updated_at: new Date().toISOString(),
  };
}

function normalizeBoampToAward(avis: any, tenderId: string) {
  return {
    tender_id: tenderId,
    winner_name: avis.titulaire_nom || avis.attributaire || null,
    winner_siren: avis.titulaire_siren || null,
    awarded_amount: avis.montant_attribue || avis.montant || null,
    award_date: avis.dateparution || null,
    num_candidates: avis.nb_offres || null,
    contract_duration: avis.duree_marche || null,
    lots_awarded: avis.lots_attribues || [],
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
  let errors: string[] = [];

  try {
    // Insert log entry
    await supabase.from("scrape_logs").insert({
      id: logId,
      source: "boamp",
      status: "running",
    });

    // Fetch last 24h of publications from BOAMP API
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0]; // YYYY-MM-DD

    // BOAMP API: search by date range
    const url = `${BOAMP_API_BASE}?date_min=${dateStr}&page_size=100&sort=dateparution:desc`;
    
    console.log(`[scrape-boamp] Fetching from: ${url}`);
    
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`BOAMP API returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const avisList = data.records || data.results || data || [];
    
    if (!Array.isArray(avisList)) {
      console.log("[scrape-boamp] Response structure:", JSON.stringify(data).substring(0, 500));
      throw new Error("Unexpected BOAMP API response format");
    }

    itemsFound = avisList.length;
    console.log(`[scrape-boamp] Found ${itemsFound} notices`);

    // Process in batches of 20
    const batchSize = 20;
    for (let i = 0; i < avisList.length; i += batchSize) {
      const batch = avisList.slice(i, i + batchSize);
      
      const tendersToUpsert = [];
      const awardsToProcess = [];

      for (const avis of batch) {
        const nature = (avis.nature || "").toUpperCase();

        if (nature === "ATTRIBUTION") {
          awardsToProcess.push(avis);
        } else {
          tendersToUpsert.push(normalizeBoampToTender(avis));
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
          .select("id, reference");

        if (error) {
          console.error("[scrape-boamp] Upsert error:", error.message);
          errors.push(`Upsert batch ${i}: ${error.message}`);
        } else {
          itemsInserted += upserted?.length || 0;
        }
      }

      // Process award notices - find matching tender by reference
      for (const avis of awardsToProcess) {
        const ref = avis.idweb || avis.id?.toString();
        // Try to find parent tender (attribution references often link to original)
        const parentRef = avis.reference_avis_initial || ref;
        
        const { data: matchingTender } = await supabase
          .from("tenders")
          .select("id")
          .eq("reference", parentRef)
          .eq("source", "boamp")
          .maybeSingle();

        if (matchingTender) {
          const award = normalizeBoampToAward(avis, matchingTender.id);
          const { error } = await supabase.from("award_notices").upsert(award, {
            onConflict: "tender_id",
          });
          if (error) {
            errors.push(`Award insert: ${error.message}`);
          }

          // Update tender status to awarded
          await supabase
            .from("tenders")
            .update({ status: "awarded" })
            .eq("id", matchingTender.id);
        }
      }
    }

    // Update log
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
      JSON.stringify({
        success: true,
        items_found: itemsFound,
        items_inserted: itemsInserted,
        errors: errors.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[scrape-boamp] Fatal error:", err);

    await supabase
      .from("scrape_logs")
      .update({
        finished_at: new Date().toISOString(),
        items_found: itemsFound,
        items_inserted: itemsInserted,
        errors: err.message,
        status: "failed",
      })
      .eq("id", logId);

    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
