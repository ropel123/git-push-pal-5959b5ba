import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TED_API_BASE = "https://api.ted.europa.eu/v3/notices/search";

function normalizeTedToTender(notice: any) {
  // Notice structure from TED: { "publication-number": "...", "links": {...}, ...fieldValues }
  const pubNumber = notice["publication-number"] || "";
  
  // Extract available data from the notice fields
  // Field names use BT-* format from eForms
  const title = notice["BT-21-Procedure"] || notice["BT-22-Lot"] || notice["title"] || pubNumber;
  const buyerName = notice["BT-500-Organization-Company"] || notice["organisation-official-name"] || null;
  const deadline = notice["BT-131(d)-Lot"] || notice["submission-deadline"] || null;
  
  return {
    title: Array.isArray(title) ? title[0] : (title || "Sans titre"),
    reference: pubNumber,
    source: "ted",
    source_url: `https://ted.europa.eu/en/notice/-/${pubNumber}`,
    buyer_name: Array.isArray(buyerName) ? buyerName[0] : buyerName,
    buyer_siret: null,
    object: null,
    procedure_type: null,
    department: null,
    region: null,
    publication_date: null, // Will be set from query context
    deadline: null,
    estimated_amount: null,
    cpv_codes: [],
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
      source: "ted",
      status: "running",
    });

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0].replace(/-/g, "");
    const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const todayFormatted = new Date().toISOString().split("T")[0];

    // Use minimal fields to avoid API errors - just get publication numbers
    // then we have the reference + source_url which is enough for MVP
    const searchPayload = {
      query: `place-of-performance = FRA AND publication-date >= ${dateStr} AND publication-date <= ${today}`,
      fields: [] as string[], // Empty = returns just publication-number and links
      limit: 100,
      page: 1,
      paginationMode: "PAGE_NUMBER",
    };

    console.log(`[scrape-ted] Searching TED for FR notices from ${dateStr} to ${today}`);

    const response = await fetch(TED_API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(searchPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TED API returned ${response.status}: ${errorText.substring(0, 500)}`);
    }

    const data = await response.json();
    const notices = data.notices || data.results || [];

    if (!Array.isArray(notices)) {
      console.log("[scrape-ted] Response keys:", Object.keys(data));
      throw new Error("Unexpected TED API response format");
    }

    itemsFound = data.totalNoticeCount || notices.length;
    console.log(`[scrape-ted] Found ${itemsFound} notices, processing ${notices.length}`);

    // Process in batches
    const batchSize = 20;
    for (let i = 0; i < notices.length; i += batchSize) {
      const batch = notices.slice(i, i + batchSize);
      const tendersToUpsert = batch
        .map((n: any) => {
          const tender = normalizeTedToTender(n);
          tender.publication_date = todayFormatted;
          return tender;
        })
        .filter((t: any) => t.reference);

      if (tendersToUpsert.length === 0) continue;

      const { data: upserted, error } = await supabase
        .from("tenders")
        .upsert(tendersToUpsert, {
          onConflict: "reference,source",
          ignoreDuplicates: false,
        })
        .select("id");

      if (error) {
        console.error("[scrape-ted] Upsert error:", error.message);
        errors.push(`Upsert batch ${i}: ${error.message}`);
      } else {
        itemsInserted += upserted?.length || 0;
      }
    }

    await supabase.from("scrape_logs").update({
      finished_at: new Date().toISOString(),
      items_found: itemsFound,
      items_inserted: itemsInserted,
      errors: errors.length > 0 ? errors.join("; ") : null,
      status: errors.length > 0 ? "completed_with_errors" : "completed",
    }).eq("id", logId);

    return new Response(
      JSON.stringify({ success: true, items_found: itemsFound, items_inserted: itemsInserted, errors: errors.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[scrape-ted] Fatal error:", err);
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
