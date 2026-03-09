import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TED_API_BASE = "https://api.ted.europa.eu/v3/notices/search";

function cleanBrackets(val: string | null): string | null {
  if (!val || typeof val !== "string") return val;
  // Remove wrapping ["..."] from stringified arrays
  const match = val.match(/^\["(.*)"\]$/s);
  return match ? match[1] : val;
}

function extractField(notice: any, field: string): string | null {
  const val = notice[field];
  if (!val) return null;
  // Handle multilingual objects like { "fra": "...", "eng": "..." }
  if (typeof val === "object" && !Array.isArray(val)) {
    return val["fra"] || val["fre"] || val["eng"] || Object.values(val)[0] as string || null;
  }
  if (Array.isArray(val)) {
    const first = val[0];
    if (typeof first === "object" && first !== null) {
      return first["fra"] || first["fre"] || first["eng"] || Object.values(first)[0] as string || null;
    }
    return first ? String(first) : null;
  }
  return String(val);
}

function normalizeTedToTender(notice: any) {
  const pubNumber = notice["publication-number"] || "";
  
  const titleRaw = extractField(notice, "notice-title") || pubNumber;
  const title = cleanBrackets(titleRaw);
  const buyerName = cleanBrackets(extractField(notice, "buyer-name"));
  const deadlineRaw = extractField(notice, "deadline-receipt-request");
  const estimatedRaw = notice["estimated-value-lot"];
  const cpvRaw = notice["classification-cpv"];
  const procedureType = extractField(notice, "procedure-type");
  const descriptionLot = notice["description-lot"];
  const pubDate = extractField(notice, "publication-date");

  // Parse deadline
  let deadline: string | null = null;
  if (deadlineRaw) {
    try { deadline = new Date(deadlineRaw).toISOString(); } catch { /* skip */ }
  }

  // Parse estimated amount
  let estimatedAmount: number | null = null;
  if (estimatedRaw) {
    const num = Array.isArray(estimatedRaw) ? estimatedRaw[0] : estimatedRaw;
    const parsed = parseFloat(String(num));
    if (!isNaN(parsed)) estimatedAmount = parsed;
  }

  // Parse CPV codes
  let cpvCodes: string[] = [];
  if (cpvRaw) {
    cpvCodes = Array.isArray(cpvRaw) ? cpvRaw.map(String) : [String(cpvRaw)];
  }

  // Parse lots
  let lots: any[] = [];
  if (descriptionLot) {
    const descs = Array.isArray(descriptionLot) ? descriptionLot : [descriptionLot];
    lots = descs.map((d: any, i: number) => ({ numero: i + 1, description: String(d) }));
  }

  return {
    title: title || "Sans titre",
    reference: pubNumber,
    source: "ted",
    source_url: `https://ted.europa.eu/en/notice/-/${pubNumber}`,
    buyer_name: buyerName,
    buyer_siret: null,
    object: title !== pubNumber ? title : null,
    procedure_type: procedureType,
    department: null,
    region: null,
    publication_date: pubDate || null,
    deadline,
    estimated_amount: estimatedAmount,
    cpv_codes: cpvCodes,
    lots,
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
      fields: ["notice-title", "buyer-name", "deadline-receipt-request", "estimated-value-lot", "classification-cpv", "procedure-type", "description-lot", "publication-date"],
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
          if (!tender.publication_date) tender.publication_date = todayFormatted;
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
