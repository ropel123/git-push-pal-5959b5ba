import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TED_API_BASE = "https://api.ted.europa.eu/v3/notices/search";

function cleanBrackets(val: string | null): string | null {
  if (!val || typeof val !== "string") return val;
  const trimmed = val.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) return String(parsed[0]);
    } catch { /* not JSON */ }
  }
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return val;
}

function extractText(val: any): string | null {
  if (!val) return null;
  if (typeof val === "string") return val;
  if (Array.isArray(val)) {
    return val.length > 0 ? extractText(val[0]) : null;
  }
  if (typeof val === "object") {
    const text = val["fra"] || val["fre"] || val["eng"] || Object.values(val)[0];
    return extractText(text);
  }
  return String(val);
}

function extractAllText(val: any): string[] {
  if (!val) return [];
  if (typeof val === "string") return [val];
  if (Array.isArray(val)) return val.flatMap(extractAllText);
  if (typeof val === "object") {
    const text = val["fra"] || val["fre"] || val["eng"] || Object.values(val)[0];
    return extractAllText(text);
  }
  return [String(val)];
}

function extractField(notice: any, field: string): string | null {
  return extractText(notice[field]);
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
  
  // Location & buyer details
  const placeOfPerformance = extractField(notice, "place-of-performance");
  const contractNature = cleanBrackets(extractField(notice, "contract-nature"));
  const buyerCity = cleanBrackets(extractField(notice, "buyer-city"));
  const buyerCountry = cleanBrackets(extractField(notice, "buyer-country"));

  // New enriched fields
  const buyerStreet = cleanBrackets(extractField(notice, "buyer-street-address"));
  const buyerPostal = cleanBrackets(extractField(notice, "buyer-postal-code"));
  const buyerEmail = cleanBrackets(extractField(notice, "buyer-email"));
  const buyerPhone = cleanBrackets(extractField(notice, "buyer-phone"));

  // Award criteria
  const awardCriteriaRaw = notice["award-criteria"];
  let awardCriteria: string | null = null;
  if (awardCriteriaRaw) {
    const texts = extractAllText(awardCriteriaRaw);
    if (texts.length > 0) awardCriteria = texts.join("\n");
  }

  // Selection criteria (participation conditions)
  const selectionCriteriaRaw = notice["selection-criteria"];
  let participationConditions: string | null = null;
  if (selectionCriteriaRaw) {
    const texts = extractAllText(selectionCriteriaRaw);
    if (texts.length > 0) participationConditions = texts.join("\n");
  }

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
    if (!isNaN(parsed) && parsed > 0) estimatedAmount = parsed;
  }

  // Parse CPV codes
  let cpvCodes: string[] = [];
  if (cpvRaw) {
    const raw = Array.isArray(cpvRaw) ? cpvRaw.map(String) : [String(cpvRaw)];
    cpvCodes = [...new Set(raw)];
  }

  // Parse lots
  let lots: any[] = [];
  if (descriptionLot) {
    const descs = extractAllText(descriptionLot);
    lots = descs.map((d: string, i: number) => ({ numero: i + 1, description: cleanBrackets(d) }));
  }

  // Description
  const description = lots.length > 0 
    ? lots.map((l: any) => l.description).filter(Boolean).join("\n\n") 
    : null;

  // Execution location
  const executionLocation = cleanBrackets(placeOfPerformance);

  // Buyer contact — enriched
  const buyerContact: Record<string, string> = {};
  if (buyerCity) buyerContact.ville = buyerCity;
  if (buyerCountry) buyerContact.pays = buyerCountry;
  if (buyerEmail) buyerContact.email = buyerEmail;
  if (buyerPhone) buyerContact.tel = buyerPhone;

  // Buyer address — full
  const addrParts = [buyerStreet, buyerPostal, buyerCity, buyerCountry].filter(Boolean);
  const buyerAddress = addrParts.length > 0 ? addrParts.join(", ") : null;

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
    description,
    execution_location: executionLocation,
    nuts_code: null,
    contract_type: contractNature,
    buyer_contact: Object.keys(buyerContact).length > 0 ? buyerContact : null,
    buyer_address: buyerAddress,
    award_criteria: awardCriteria,
    participation_conditions: participationConditions,
    additional_info: null,
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

    const LIMIT = 100;
    let page = 1;
    let totalProcessed = 0;

    while (true) {
      const searchPayload = {
        query: `place-of-performance = FRA AND publication-date >= ${dateStr} AND publication-date <= ${today}`,
        fields: [
          "notice-title", "buyer-name", "deadline-receipt-request",
          "estimated-value-lot", "classification-cpv", "procedure-type",
          "description-lot", "publication-date",
          "place-of-performance", "contract-nature", "buyer-city", "buyer-country",
        ],
        limit: LIMIT,
        page,
        paginationMode: "PAGE_NUMBER",
      };

      console.log(`[scrape-ted] Page ${page}: Searching TED for FR notices from ${dateStr} to ${today}`);

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

      if (page === 1) {
        itemsFound = data.totalNoticeCount || notices.length;
        console.log(`[scrape-ted] Total notices: ${itemsFound}`);
      }

      if (notices.length === 0) break;

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
          errors.push(`Upsert page ${page} batch ${i}: ${error.message}`);
        } else {
          itemsInserted += upserted?.length || 0;
        }
      }

      totalProcessed += notices.length;
      
      // Stop if we got fewer than LIMIT (last page) or reached reasonable max
      if (notices.length < LIMIT || totalProcessed >= 2000) break;
      page++;
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
