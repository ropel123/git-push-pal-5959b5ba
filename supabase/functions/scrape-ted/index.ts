import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TED_API_BASE = "https://api.ted.europa.eu/v3/notices/search";

// ── NUTS prefix → French region mapping ──
const NUTS_TO_REGION: Record<string, string> = {
  FR1: "Île-de-France",
  FRB: "Centre-Val de Loire",
  FRC: "Bourgogne-Franche-Comté",
  FRD: "Normandie",
  FRE: "Hauts-de-France",
  FRF: "Grand Est",
  FRG: "Pays de la Loire",
  FRH: "Bretagne",
  FRI: "Nouvelle-Aquitaine",
  FRJ: "Occitanie",
  FRK: "Auvergne-Rhône-Alpes",
  FRL: "Provence-Alpes-Côte d'Azur",
  FRM: "Corse",
  FRY: "Outre-mer",
  FRZZ: "France",
};

// ── contract_nature → French label ──
const CONTRACT_TYPE_MAP: Record<string, string> = {
  works: "Travaux",
  services: "Services",
  supplies: "Fournitures",
};

// ── form-type → tender status ──
function mapFormTypeToStatus(formType: string | null): "open" | "closed" | "cancelled" | "awarded" {
  if (!formType) return "open";
  const ft = formType.toLowerCase();
  if (ft.includes("result") || ft.includes("award")) return "awarded";
  if (ft.includes("cancel")) return "cancelled";
  return "open";
}

function regionFromNuts(nutsCode: string | null): string | null {
  if (!nutsCode) return null;
  // Try exact then prefix matches (FRL03 → FRL, FR10 → FR1)
  for (let len = nutsCode.length; len >= 2; len--) {
    const prefix = nutsCode.substring(0, len);
    if (NUTS_TO_REGION[prefix]) return NUTS_TO_REGION[prefix];
  }
  return null;
}

// ── Utility functions ──

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

function extractAllFields(notice: any, field: string): string[] {
  return extractAllText(notice[field]);
}

// ── Main normalizer ──

function normalizeTedToTender(notice: any) {
  const pubNumber = notice["publication-number"] || "";

  // Basic fields
  const titleRaw = extractField(notice, "notice-title") || pubNumber;
  const title = cleanBrackets(titleRaw);
  const buyerName = cleanBrackets(extractField(notice, "buyer-name"));
  const deadlineRaw = extractField(notice, "deadline-receipt-request");
  const estimatedRaw = notice["estimated-value-lot"];
  const cpvRaw = notice["classification-cpv"];
  const procedureType = extractField(notice, "procedure-type");
  const descriptionLot = notice["description-lot"];
  const pubDate = extractField(notice, "publication-date");

  // Form type → dynamic status
  const formType = extractField(notice, "form-type");
  const status = mapFormTypeToStatus(formType);

  // Location & buyer details
  const placeOfPerformance = extractField(notice, "place-of-performance");
  const contractNature = cleanBrackets(extractField(notice, "contract-nature"));
  const buyerCity = cleanBrackets(extractField(notice, "buyer-city"));
  const buyerCountry = cleanBrackets(extractField(notice, "buyer-country"));

  // Enriched buyer fields
  const buyerStreet = cleanBrackets(extractField(notice, "buyer-street-address"));
  const buyerPostal = cleanBrackets(extractField(notice, "buyer-postal-code"));
  const buyerEmail = cleanBrackets(extractField(notice, "buyer-email"));
  const buyerPhone = cleanBrackets(extractField(notice, "buyer-phone"));
  const buyerUrl = cleanBrackets(extractField(notice, "buyer-url"));

  // NUTS code
  const nutsRaw = extractField(notice, "place-of-performance-country-sub");
  const nutsCode = cleanBrackets(nutsRaw);
  const region = regionFromNuts(nutsCode);

  // Short description (procedure-level)
  const shortDesc = extractField(notice, "short-description");

  // ── Award criteria (structured) ──
  const criteriaNames = extractAllFields(notice, "award-criterion-name-lot");
  const criteriaWeights = extractAllFields(notice, "award-criterion-number-weight-lot");
  let awardCriteria: string | null = null;

  if (criteriaNames.length > 0) {
    const lines = criteriaNames.map((name, i) => {
      const cleaned = cleanBrackets(name);
      const weight = criteriaWeights[i] ? cleanBrackets(criteriaWeights[i]) : null;
      return weight ? `${cleaned} : ${weight}%` : cleaned;
    });
    awardCriteria = lines.filter(Boolean).join("\n");
  }
  // Fallback to old field
  if (!awardCriteria) {
    const oldCriteria = notice["award-criteria"];
    if (oldCriteria) {
      const texts = extractAllText(oldCriteria);
      if (texts.length > 0) awardCriteria = texts.join("\n");
    }
  }

  // ── Selection criteria → participation conditions ──
  const selTypes = extractAllFields(notice, "selection-criteria-type-lot");
  const selDescs = extractAllFields(notice, "selection-criteria-description-lot");
  let participationConditions: string | null = null;

  if (selTypes.length > 0 || selDescs.length > 0) {
    const lines: string[] = [];
    const maxLen = Math.max(selTypes.length, selDescs.length);
    for (let i = 0; i < maxLen; i++) {
      const type = selTypes[i] ? cleanBrackets(selTypes[i]) : null;
      const desc = selDescs[i] ? cleanBrackets(selDescs[i]) : null;
      if (type && desc) lines.push(`${type} : ${desc}`);
      else if (desc) lines.push(desc);
      else if (type) lines.push(type);
    }
    if (lines.length > 0) participationConditions = lines.join("\n");
  }
  // Fallback to old field
  if (!participationConditions) {
    const oldSel = notice["selection-criteria"];
    if (oldSel) {
      const texts = extractAllText(oldSel);
      if (texts.length > 0) participationConditions = texts.join("\n");
    }
  }

  // ── Additional info ──
  const additionalInfoLot = extractAllFields(notice, "additional-information-lot");
  const durationLot = extractField(notice, "duration-lot");
  const frameworkAgreement = extractField(notice, "framework-agreement-lot");

  const additionalParts: string[] = [];
  if (additionalInfoLot.length > 0) {
    additionalParts.push(...additionalInfoLot.map(t => cleanBrackets(t)).filter(Boolean) as string[]);
  }
  if (durationLot) additionalParts.push(`Durée : ${cleanBrackets(durationLot)}`);
  if (frameworkAgreement) additionalParts.push(`Accord-cadre : ${cleanBrackets(frameworkAgreement)}`);
  const additionalInfo = additionalParts.length > 0 ? additionalParts.join("\n") : null;

  // ── Winner / award data (for Result notices) ──
  const winnerName = cleanBrackets(extractField(notice, "winner-chosen-lot"));
  const contractValueRaw = notice["contract-value"];
  let awardedAmount: number | null = null;
  if (contractValueRaw) {
    const num = Array.isArray(contractValueRaw) ? contractValueRaw[0] : contractValueRaw;
    const parsed = parseFloat(String(num));
    if (!isNaN(parsed) && parsed > 0) awardedAmount = parsed;
  }
  const receivedSubmissionsRaw = notice["received-submissions-count"];
  let numCandidates: number | null = null;
  if (receivedSubmissionsRaw) {
    const num = Array.isArray(receivedSubmissionsRaw) ? receivedSubmissionsRaw[0] : receivedSubmissionsRaw;
    const parsed = parseInt(String(num), 10);
    if (!isNaN(parsed) && parsed > 0) numCandidates = parsed;
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
  // For awarded notices, use contract value as fallback
  if (!estimatedAmount && awardedAmount) {
    estimatedAmount = awardedAmount;
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

  // Description: short description (procedure) + lot descriptions
  const descParts: string[] = [];
  if (shortDesc) descParts.push(cleanBrackets(shortDesc) || "");
  if (lots.length > 0) {
    const lotDescs = lots.map((l: any) => l.description).filter(Boolean).join("\n\n");
    if (lotDescs) descParts.push(lotDescs);
  }
  const description = descParts.length > 0 ? descParts.join("\n\n") : null;

  // Execution location: prefer city from place-of-performance, fallback to buyer city
  const executionLocation = cleanBrackets(placeOfPerformance) || buyerCity || null;

  // Buyer contact — enriched
  const buyerContact: Record<string, string> = {};
  if (buyerCity) buyerContact.ville = buyerCity;
  if (buyerCountry) buyerContact.pays = buyerCountry;
  if (buyerEmail) buyerContact.email = buyerEmail;
  if (buyerPhone) buyerContact.tel = buyerPhone;
  if (buyerUrl) buyerContact.url = buyerUrl;

  // Buyer address — full
  const addrParts = [buyerStreet, buyerPostal, buyerCity, buyerCountry].filter(Boolean);
  const buyerAddress = addrParts.length > 0 ? addrParts.join(", ") : null;

  // Contract type — normalized to French
  const contractType = contractNature
    ? (CONTRACT_TYPE_MAP[contractNature.toLowerCase()] || contractNature)
    : null;

  return {
    tender: {
      title: title || "Sans titre",
      reference: pubNumber,
      source: "ted",
      source_url: `https://ted.europa.eu/en/notice/-/${pubNumber}`,
      buyer_name: buyerName,
      buyer_siret: null,
      object: title !== pubNumber ? title : null,
      procedure_type: procedureType,
      department: null,
      region,
      publication_date: pubDate || null,
      deadline,
      estimated_amount: estimatedAmount,
      cpv_codes: cpvCodes,
      lots,
      status,
      updated_at: new Date().toISOString(),
      description,
      execution_location: executionLocation,
      nuts_code: nutsCode,
      contract_type: contractType,
      buyer_contact: Object.keys(buyerContact).length > 0 ? buyerContact : null,
      buyer_address: buyerAddress,
      award_criteria: awardCriteria,
      participation_conditions: participationConditions,
      additional_info: additionalInfo,
    },
    // Award data (only relevant for "Result" notices)
    award: (status === "awarded" && winnerName)
      ? {
          winner_name: winnerName,
          awarded_amount: awardedAmount,
          num_candidates: numCandidates,
          award_date: pubDate || null,
        }
      : null,
  };
}

// ── Edge function handler ──

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
  let awardsInserted = 0;
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
          // Basic
          "notice-title", "buyer-name", "deadline-receipt-request",
          "estimated-value-lot", "classification-cpv", "procedure-type",
          "description-lot", "publication-date",
          "place-of-performance", "contract-nature", "buyer-city", "buyer-country",
          // Enriched buyer
          "buyer-street-address", "buyer-postal-code", "buyer-email", "buyer-phone", "buyer-url",
          // Form type & status
          "form-type",
          // NUTS
          "place-of-performance-country-sub",
          // Award criteria (structured)
          "award-criterion-name-lot", "award-criterion-number-weight-lot",
          // Selection criteria
          "selection-criteria-type-lot", "selection-criteria-description-lot",
          // Description enriched
          "short-description",
          // Additional lot info
          "additional-information-lot", "duration-lot", "framework-agreement-lot",
          // Award / result data
          "received-submissions-count", "winner-chosen-lot", "contract-value",
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
        const parsed = batch.map((n: any) => {
          const result = normalizeTedToTender(n);
          if (!result.tender.publication_date) result.tender.publication_date = todayFormatted;
          return result;
        }).filter((r: any) => r.tender.reference);

        const tendersToUpsert = parsed.map((r: any) => r.tender);

        if (tendersToUpsert.length === 0) continue;

        const { data: upserted, error } = await supabase
          .from("tenders")
          .upsert(tendersToUpsert, {
            onConflict: "reference,source",
            ignoreDuplicates: false,
          })
          .select("id, reference");

        if (error) {
          console.error("[scrape-ted] Upsert error:", error.message);
          errors.push(`Upsert page ${page} batch ${i}: ${error.message}`);
        } else {
          itemsInserted += upserted?.length || 0;

          // Insert award_notices for "awarded" tenders
          if (upserted && upserted.length > 0) {
            const awardNotices: any[] = [];
            for (const row of upserted) {
              const match = parsed.find((r: any) => r.tender.reference === row.reference);
              if (match?.award) {
                awardNotices.push({
                  tender_id: row.id,
                  winner_name: match.award.winner_name,
                  awarded_amount: match.award.awarded_amount,
                  num_candidates: match.award.num_candidates,
                  award_date: match.award.award_date,
                });
              }
            }
            if (awardNotices.length > 0) {
              const { error: awardErr, data: awardData } = await supabase
                .from("award_notices")
                .upsert(awardNotices, {
                  onConflict: "tender_id",
                  ignoreDuplicates: false,
                })
                .select("id");

              if (awardErr) {
                console.error("[scrape-ted] Award insert error:", awardErr.message);
                errors.push(`Awards page ${page}: ${awardErr.message}`);
              } else {
                awardsInserted += awardData?.length || 0;
              }
            }
          }
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
      JSON.stringify({
        success: true,
        items_found: itemsFound,
        items_inserted: itemsInserted,
        awards_inserted: awardsInserted,
        errors: errors.length,
      }),
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
