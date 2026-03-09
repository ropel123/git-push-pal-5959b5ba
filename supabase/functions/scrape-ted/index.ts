import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TED_API_BASE = "https://api.ted.europa.eu/v3/notices/search";

function normalizeTedToTender(notice: any) {
  const publication = notice.publicationDate || notice.publication_date;
  const deadline = notice.submissionDeadline || notice.deadline;
  const buyer = notice.buyer || notice.organisation || {};
  const cpvCodes = notice.cpvCodes || notice.cpv || [];

  return {
    title: notice.title?.trim() || notice.titleText || "Sans titre",
    reference: notice.noticeId || notice.tedNoticeId || notice.id,
    source: "ted",
    source_url: `https://ted.europa.eu/en/notice/-/${notice.noticeId || notice.id}`,
    buyer_name: buyer.officialName || buyer.name || null,
    buyer_siret: null, // TED doesn't use SIRET
    object: notice.description || notice.shortDescription || null,
    procedure_type: notice.procedureType || null,
    department: null,
    region: notice.placeOfPerformance?.region || notice.nuts?.join(", ") || null,
    publication_date: publication || null,
    deadline: deadline || null,
    estimated_amount: notice.estimatedValue?.amount || notice.totalValue?.amount || null,
    cpv_codes: Array.isArray(cpvCodes) ? cpvCodes : [cpvCodes].filter(Boolean),
    lots: notice.lots || [],
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
  let errors: string[] = [];

  try {
    await supabase.from("scrape_logs").insert({
      id: logId,
      source: "ted",
      status: "running",
    });

    // Search for French notices published in the last 24h
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0];
    const today = new Date().toISOString().split("T")[0];

    // TED API v3 search query - filter France + recent publications
    const searchPayload = {
      query: "country=FRA",
      fields: [
        "title", "noticeId", "publicationDate", "submissionDeadline",
        "buyer", "description", "procedureType", "cpvCodes",
        "estimatedValue", "placeOfPerformance", "lots", "nuts"
      ],
      pageSize: 100,
      page: 1,
      scope: "ALL",
      publicationDateFrom: dateStr,
      publicationDateTo: today,
    };

    console.log(`[scrape-ted] Searching TED for notices from ${dateStr} to ${today}`);

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
      throw new Error(`TED API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const notices = data.notices || data.results || data.content || [];

    if (!Array.isArray(notices)) {
      console.log("[scrape-ted] Response structure:", JSON.stringify(data).substring(0, 500));
      throw new Error("Unexpected TED API response format");
    }

    itemsFound = notices.length;
    console.log(`[scrape-ted] Found ${itemsFound} notices`);

    // Process in batches
    const batchSize = 20;
    for (let i = 0; i < notices.length; i += batchSize) {
      const batch = notices.slice(i, i + batchSize);
      const tendersToUpsert = batch.map(normalizeTedToTender);

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

    // Handle pagination if more results
    const totalPages = data.totalPages || 1;
    if (totalPages > 1) {
      console.log(`[scrape-ted] Note: ${totalPages} pages available, only fetched page 1`);
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
      JSON.stringify({
        success: true,
        items_found: itemsFound,
        items_inserted: itemsInserted,
        errors: errors.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[scrape-ted] Fatal error:", err);

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
