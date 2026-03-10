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
function mapFormTypeToStatus(formType: string | null, noticeType: string | null): "open" | "closed" | "cancelled" | "awarded" {
  const ft = (formType || "").toLowerCase();
  const nt = (noticeType || "").toLowerCase();
  if (ft.includes("result") || ft.includes("award") || nt === "can") return "awarded";
  if (ft.includes("cancel")) return "cancelled";
  return "open";
}

function regionFromNuts(nutsCode: string | null): string | null {
  if (!nutsCode) return null;
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

function parseNumber(raw: any): number | null {
  if (!raw) return null;
  const num = Array.isArray(raw) ? raw[0] : raw;
  const parsed = parseFloat(String(num));
  return !isNaN(parsed) && parsed > 0 ? parsed : null;
}

function parseInt2(raw: any): number | null {
  if (!raw) return null;
  const num = Array.isArray(raw) ? raw[0] : raw;
  const parsed = parseInt(String(num), 10);
  return !isNaN(parsed) && parsed > 0 ? parsed : null;
}

// ── Main normalizer ──

function normalizeTedToTender(notice: any) {
  const pubNumber = notice["publication-number"] || "";

  // Basic fields
  const titleRaw = extractField(notice, "notice-title") || pubNumber;
  const title = cleanBrackets(titleRaw);
  const buyerName = cleanBrackets(extractField(notice, "buyer-name"));
  const deadlineRaw = extractField(notice, "deadline-receipt-request");
  const cpvRaw = notice["classification-cpv"];
  const procedureType = extractField(notice, "procedure-type");
  const pubDate = extractField(notice, "publication-date");

  // Form type + notice type → dynamic status
  const formType = extractField(notice, "form-type");
  const noticeType = extractField(notice, "notice-type");
  const status = mapFormTypeToStatus(formType, noticeType);

  // Location & buyer details
  const placeOfPerformance = extractField(notice, "place-of-performance");
  const contractNature = cleanBrackets(extractField(notice, "contract-nature"));
  const buyerCity = cleanBrackets(extractField(notice, "buyer-city"));
  const buyerCountry = cleanBrackets(extractField(notice, "buyer-country"));

  // Enriched buyer fields
  const buyerStreet = cleanBrackets(extractField(notice, "organisation-street-buyer"));
  const buyerPostal = cleanBrackets(extractField(notice, "buyer-post-code"));
  const buyerEmail = cleanBrackets(extractField(notice, "buyer-email"));
  const buyerPhone = cleanBrackets(extractField(notice, "organisation-tel-buyer"));
  const buyerUrl = cleanBrackets(extractField(notice, "buyer-internet-address"));
  const buyerIdentifier = cleanBrackets(extractField(notice, "buyer-identifier"));
  const buyerLegalType = cleanBrackets(extractField(notice, "buyer-legal-type"));
  const buyerProfile = cleanBrackets(extractField(notice, "buyer-profile"));

  // NUTS code
  const nutsRaw = extractField(notice, "place-of-performance-subdiv-lot");
  const nutsCode = cleanBrackets(nutsRaw);
  const region = regionFromNuts(nutsCode);

  // Place of performance city
  const perfCity = cleanBrackets(extractField(notice, "place-of-performance-city-lot"));
  const perfPostCode = cleanBrackets(extractField(notice, "place-of-performance-post-code-lot"));

  // Descriptions
  const descProc = extractField(notice, "description-proc");
  const descriptionLot = notice["description-lot"];
  const additionalInfoProc = extractField(notice, "additional-info-proc");

  // ── Lots enrichis ──
  const lotTitles = extractAllFields(notice, "title-lot");
  const lotIds = extractAllFields(notice, "internal-identifier-lot");
  const lotDescs = extractAllText(descriptionLot);
  const lotOptions = extractAllFields(notice, "option-description-lot");
  const lotRenewals = extractAllFields(notice, "renewal-description-lot");
  const lotRenewalMax = extractAllFields(notice, "renewal-maximum-lot");

  const maxLots = Math.max(lotTitles.length, lotDescs.length, 0);
  let lots: any[] = [];
  if (maxLots > 0) {
    lots = Array.from({ length: maxLots }, (_, i) => {
      const lot: any = { numero: i + 1 };
      if (lotTitles[i]) lot.titre = cleanBrackets(lotTitles[i]);
      if (lotIds[i]) lot.identifiant = cleanBrackets(lotIds[i]);
      if (lotDescs[i]) lot.description = cleanBrackets(lotDescs[i]);
      if (lotOptions[i]) lot.options = cleanBrackets(lotOptions[i]);
      if (lotRenewals[i]) lot.reconductions = cleanBrackets(lotRenewals[i]);
      if (lotRenewalMax[i]) lot.reconductions_max = cleanBrackets(lotRenewalMax[i]);
      return lot;
    });
  }

  // ── Award criteria (structured + descriptions) ──
  const criteriaNames = extractAllFields(notice, "award-criterion-name-lot");
  const criteriaWeights = extractAllFields(notice, "award-criterion-number-weight-lot");
  const criteriaTypes = extractAllFields(notice, "award-criterion-type-lot");
  const criteriaDescs = extractAllFields(notice, "award-criterion-description-lot");
  let awardCriteria: string | null = null;

  if (criteriaNames.length > 0) {
    const maxCrit = Math.max(criteriaNames.length, criteriaDescs.length);
    const lines = Array.from({ length: maxCrit }, (_, i) => {
      const name = criteriaNames[i] ? cleanBrackets(criteriaNames[i]) : null;
      const weight = criteriaWeights[i] ? cleanBrackets(criteriaWeights[i]) : null;
      const type = criteriaTypes[i] ? cleanBrackets(criteriaTypes[i]) : null;
      const desc = criteriaDescs[i] ? cleanBrackets(criteriaDescs[i]) : null;

      let line = name || type || "Critère";
      if (weight) line += ` (${weight}%)`;
      if (desc) line += ` : ${desc}`;
      return line;
    });
    awardCriteria = lines.filter(Boolean).join("\n");
  }
  if (!awardCriteria) {
    const oldCriteria = notice["award-criteria"];
    if (oldCriteria) {
      const texts = extractAllText(oldCriteria);
      if (texts.length > 0) awardCriteria = texts.join("\n");
    }
  }

  // ── Selection criteria + exclusion + financial/performance conditions ──
  const selNames = extractAllFields(notice, "selection-criterion-name-lot");
  const selDescs = extractAllFields(notice, "selection-criterion-description-lot");
  const selTypes = extractAllFields(notice, "selection-criterion-lot");
  const exclusionGrounds = extractField(notice, "exclusion-grounds");
  const exclusionDesc = extractField(notice, "exclusion-grounds-description");
  const termsFinancial = extractField(notice, "terms-financial-lot");
  const termPerformance = extractField(notice, "term-performance-lot");

  const conditionParts: string[] = [];

  // Selection criteria
  if (selNames.length > 0 || selDescs.length > 0 || selTypes.length > 0) {
    const maxLen = Math.max(selNames.length, selDescs.length, selTypes.length);
    for (let i = 0; i < maxLen; i++) {
      const name = selNames[i] ? cleanBrackets(selNames[i]) : null;
      const desc = selDescs[i] ? cleanBrackets(selDescs[i]) : null;
      const type = selTypes[i] ? cleanBrackets(selTypes[i]) : null;
      const label = name || type;
      if (label && desc) conditionParts.push(`${label} : ${desc}`);
      else if (desc) conditionParts.push(desc);
      else if (label) conditionParts.push(label);
    }
  }

  // Exclusion grounds
  if (exclusionDesc) {
    conditionParts.push(`Motifs d'exclusion : ${cleanBrackets(exclusionDesc)}`);
  } else if (exclusionGrounds) {
    conditionParts.push(`Motifs d'exclusion : ${cleanBrackets(exclusionGrounds)}`);
  }

  // Financial terms
  if (termsFinancial) {
    conditionParts.push(`Conditions financières : ${cleanBrackets(termsFinancial)}`);
  }

  // Performance terms
  if (termPerformance) {
    conditionParts.push(`Conditions d'exécution : ${cleanBrackets(termPerformance)}`);
  }

  let participationConditions: string | null = conditionParts.length > 0 ? conditionParts.join("\n") : null;

  // Fallbacks
  if (!participationConditions) {
    const selSource = extractField(notice, "selection-criteria-source");
    if (selSource) participationConditions = "Critères définis dans les documents de la consultation";
  }
  if (!participationConditions) {
    const oldSel = notice["selection-criteria"];
    if (oldSel) {
      const texts = extractAllText(oldSel);
      if (texts.length > 0) participationConditions = texts.join("\n");
    }
  }

  // ── Additional info (enriched) ──
  const additionalInfoLot = extractAllFields(notice, "additional-information-lot");
  const durationLot = extractField(notice, "contract-duration-period-lot");
  const durationUnit = extractField(notice, "duration-period-unit-lot");
  const durationStart = extractField(notice, "contract-duration-start-date-lot");
  const durationEnd = extractField(notice, "contract-duration-end-date-lot");
  const frameworkAgreement = extractField(notice, "framework-agreement-lot");
  const frameworkMaxValue = extractField(notice, "framework-maximum-value-lot");
  const documentUrl = extractField(notice, "document-url-lot");
  const submissionUrl = extractField(notice, "submission-url-lot");
  const subcontractingDesc = extractField(notice, "subcontracting-description");
  const subcontractingValue = extractField(notice, "subcontracting-value");

  const additionalParts: string[] = [];
  if (additionalInfoLot.length > 0) {
    additionalParts.push(...additionalInfoLot.map(t => cleanBrackets(t)).filter(Boolean) as string[]);
  }
  if (additionalInfoProc) additionalParts.push(cleanBrackets(additionalInfoProc) || "");
  if (durationLot) {
    const unit = durationUnit ? ` ${cleanBrackets(durationUnit)}` : "";
    additionalParts.push(`Durée : ${cleanBrackets(durationLot)}${unit}`);
  }
  if (durationStart || durationEnd) {
    const parts = [];
    if (durationStart) parts.push(`début : ${cleanBrackets(durationStart)}`);
    if (durationEnd) parts.push(`fin : ${cleanBrackets(durationEnd)}`);
    additionalParts.push(`Période : ${parts.join(", ")}`);
  }
  if (frameworkAgreement) additionalParts.push(`Accord-cadre : ${cleanBrackets(frameworkAgreement)}`);
  if (frameworkMaxValue) additionalParts.push(`Valeur max accord-cadre : ${cleanBrackets(frameworkMaxValue)}`);
  if (documentUrl) additionalParts.push(`Documents : ${cleanBrackets(documentUrl)}`);
  if (submissionUrl) additionalParts.push(`Dépôt des offres : ${cleanBrackets(submissionUrl)}`);
  if (subcontractingDesc) additionalParts.push(`Sous-traitance : ${cleanBrackets(subcontractingDesc)}`);
  if (subcontractingValue) additionalParts.push(`Montant sous-traitance : ${cleanBrackets(subcontractingValue)}`);
  const additionalInfo = additionalParts.length > 0 ? additionalParts.join("\n") : null;

  // ── Winner / award data ──
  const winnerName = cleanBrackets(extractField(notice, "organisation-name-tenderer"));
  const winnerIdentifier = cleanBrackets(extractField(notice, "organisation-identifier-tenderer"));
  const contractConclusionDateRaw = extractField(notice, "contract-conclusion-date");
  // TED returns dates like "2025-12-19-04:00" — sanitize to valid ISO date
  let contractConclusionDate: string | null = null;
  if (contractConclusionDateRaw) {
    const dateOnly = contractConclusionDateRaw.substring(0, 10); // "2025-12-19"
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) contractConclusionDate = dateOnly;
  }
  const contractIdentifier = extractField(notice, "contract-identifier");
  const tenderRank = extractField(notice, "tender-rank");

  let awardedAmount: number | null = null;
  for (const raw of [notice["tender-value"], notice["result-value-lot"]]) {
    if (raw && !awardedAmount) awardedAmount = parseNumber(raw);
  }

  const numCandidates = parseInt2(notice["received-submissions-type-val"]);

  // Parse deadline
  let deadline: string | null = null;
  if (deadlineRaw) {
    try { deadline = new Date(deadlineRaw).toISOString(); } catch { /* skip */ }
  }

  // Parse estimated amount (lot level, then procedure level fallback)
  let estimatedAmount = parseNumber(notice["estimated-value-lot"]);
  if (!estimatedAmount) estimatedAmount = parseNumber(notice["estimated-value-proc"]);
  if (!estimatedAmount && awardedAmount) estimatedAmount = awardedAmount;

  // Parse CPV codes
  let cpvCodes: string[] = [];
  if (cpvRaw) {
    const raw = Array.isArray(cpvRaw) ? cpvRaw.map(String) : [String(cpvRaw)];
    cpvCodes = [...new Set(raw)];
  }

  // Description: procedure description + lot descriptions
  const descParts: string[] = [];
  if (descProc) descParts.push(cleanBrackets(descProc) || "");
  if (lots.length > 0) {
    const lotDescsText = lots.map((l: any) => {
      const parts = [];
      if (l.titre) parts.push(`Lot ${l.numero} — ${l.titre}`);
      if (l.description) parts.push(l.description);
      return parts.join("\n");
    }).filter(Boolean).join("\n\n");
    if (lotDescsText) descParts.push(lotDescsText);
  }
  const description = descParts.length > 0 ? descParts.join("\n\n") : null;

  // Execution location
  const executionParts = [perfCity, perfPostCode].filter(Boolean);
  const executionLocation = executionParts.length > 0
    ? executionParts.join(", ")
    : (cleanBrackets(placeOfPerformance) || buyerCity || null);

  // Buyer contact — enriched
  const buyerContact: Record<string, string> = {};
  if (buyerCity) buyerContact.ville = buyerCity;
  if (buyerCountry) buyerContact.pays = buyerCountry;
  if (buyerEmail) buyerContact.email = buyerEmail;
  if (buyerPhone) buyerContact.tel = buyerPhone;
  if (buyerUrl) buyerContact.url = buyerUrl;
  if (buyerLegalType) buyerContact.type_juridique = buyerLegalType;
  if (buyerProfile) buyerContact.profil_acheteur = buyerProfile;

  // Buyer address
  const addrParts = [buyerStreet, buyerPostal, buyerCity, buyerCountry].filter(Boolean);
  const buyerAddress = addrParts.length > 0 ? addrParts.join(", ") : null;

  // Contract type
  const contractType = contractNature
    ? (CONTRACT_TYPE_MAP[contractNature.toLowerCase()] || contractNature)
    : null;

  // Buyer SIRET
  let buyerSiret: string | null = null;
  if (buyerIdentifier) {
    const cleaned = buyerIdentifier.replace(/\s/g, "");
    if (/^\d{9,14}$/.test(cleaned)) buyerSiret = cleaned;
  }

  // Winner SIREN
  let winnerSiren: string | null = null;
  if (winnerIdentifier) {
    const cleaned = winnerIdentifier.replace(/\s/g, "");
    if (/^\d{9,14}$/.test(cleaned)) winnerSiren = cleaned;
  }

  return {
    tender: {
      title: title || "Sans titre",
      reference: pubNumber,
      source: "ted",
      source_url: `https://ted.europa.eu/en/notice/-/${pubNumber}`,
      buyer_name: buyerName,
      buyer_siret: buyerSiret,
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
      dce_url: documentUrl ? cleanBrackets(documentUrl) : null,
      submission_url: submissionUrl ? cleanBrackets(submissionUrl) : null,
    },
    award: (status === "awarded" && winnerName)
      ? {
          winner_name: winnerName,
          winner_siren: winnerSiren,
          awarded_amount: awardedAmount,
          num_candidates: numCandidates,
          award_date: contractConclusionDate || pubDate || null,
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
          // Buyer contact enriched
          "organisation-street-buyer", "buyer-post-code", "buyer-email",
          "organisation-tel-buyer", "buyer-internet-address", "buyer-identifier",
          "buyer-legal-type", "buyer-profile",
          // Form/notice type for status
          "form-type", "notice-type",
          // NUTS & performance location
          "place-of-performance-subdiv-lot", "place-of-performance-city-lot",
          "place-of-performance-post-code-lot",
          // Procedure description
          "description-proc", "additional-info-proc",
          // Award criteria (structured + descriptions)
          "award-criterion-name-lot", "award-criterion-number-weight-lot",
          "award-criterion-type-lot", "award-criterion-description-lot",
          // Selection criteria
          "selection-criterion-name-lot", "selection-criterion-description-lot",
          "selection-criterion-lot", "selection-criteria-source",
          // Exclusion & conditions
          "exclusion-grounds", "exclusion-grounds-description",
          "terms-financial-lot", "term-performance-lot",
          // Lot enrichment
          "title-lot", "internal-identifier-lot",
          "estimated-value-proc", "framework-maximum-value-lot",
          "option-description-lot", "renewal-description-lot", "renewal-maximum-lot",
          "contract-duration-start-date-lot", "contract-duration-end-date-lot",
          // Additional lot info
          "additional-information-lot", "contract-duration-period-lot",
          "duration-period-unit-lot", "framework-agreement-lot",
          // Documents & submission
          "document-url-lot", "submission-url-lot",
          // Award / result data
          "received-submissions-type-val", "organisation-name-tenderer",
          "organisation-identifier-tenderer",
          "tender-value", "result-value-lot",
          "contract-conclusion-date", "contract-identifier",
          "subcontracting-description", "subcontracting-value", "tender-rank",
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

      // Diagnostic: log sample notice keys on first page
      if (page === 1 && notices.length > 0) {
        const sampleKeys = Object.keys(notices[0]).sort();
        console.log(`[scrape-ted] DIAGNOSTIC — Sample notice has ${sampleKeys.length} keys:`, JSON.stringify(sampleKeys));
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
                  winner_siren: match.award.winner_siren,
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
