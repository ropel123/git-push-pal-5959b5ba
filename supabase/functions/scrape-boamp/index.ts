import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BOAMP_API_BASE = "https://www.boamp.fr/api/explore/v2.1/catalog/datasets/boamp/records";

// Safely traverse nested objects
function dig(obj: any, ...keys: string[]): any {
  let cur = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== "object") return null;
    cur = cur[k];
  }
  return cur ?? null;
}

// Extract text from potentially nested/array values
function textify(val: any): string | null {
  if (!val) return null;
  if (typeof val === "string") return val.trim() || null;
  if (Array.isArray(val)) return val.map(textify).filter(Boolean).join("\n") || null;
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function parseBoampDonnees(raw: any): Record<string, any> {
  let donnees: any = null;
  if (!raw) return {};

  // donnees can be a JSON string or already parsed
  if (typeof raw === "string") {
    try { donnees = JSON.parse(raw); } catch { return {}; }
  } else {
    donnees = raw;
  }

  // The structure varies: sometimes it's nested under AVIS, MARCHE, etc.
  // Try common paths
  const objet = dig(donnees, "OBJET") || dig(donnees, "DONNEES", "OBJET") || {};
  const identite = dig(donnees, "IDENTITE") || dig(donnees, "DONNEES", "IDENTITE") || {};
  const procedure = dig(donnees, "PROCEDURE") || dig(donnees, "DONNEES", "PROCEDURE") || {};
  const condition = dig(donnees, "CONDITION") || dig(procedure, "CONDITION_PARTICIPATION") || {};

  // Description complete
  const description = textify(objet.OBJET_COMPLET) || textify(objet.DESCRIPTION) || null;

  // Better title
  const titreMarche = textify(objet.TITRE_MARCHE) || null;

  // CPV codes from donnees
  let cpvCodes: string[] = [];
  const cpvData = objet.CPV;
  if (Array.isArray(cpvData)) {
    cpvCodes = cpvData.map((c: any) => c?.PRINCIPAL || c?.CODE || c).filter(Boolean).map(String);
  } else if (cpvData?.PRINCIPAL) {
    cpvCodes = [String(cpvData.PRINCIPAL)];
  }

  // Lieu d'execution
  const lieuExec = dig(objet, "LIEU_EXEC_LIVR") || dig(objet, "LIEU_EXECUTION") || {};
  const executionLocation = textify(lieuExec.LIBELLE) || textify(lieuExec.LIEU) || null;
  const nutsCode = textify(lieuExec.CODE_NUTS) || null;

  // Buyer address & contact
  const adresse = [identite.ADRESSE, identite.CP, identite.VILLE].filter(Boolean).join(", ") || null;
  const buyerContact: Record<string, string> = {};
  if (identite.MEL) buyerContact.email = String(identite.MEL);
  if (identite.TEL) buyerContact.tel = String(identite.TEL);
  if (identite.URL) buyerContact.url = String(identite.URL);
  if (identite.VILLE) buyerContact.ville = String(identite.VILLE);

  // SIRET
  const buyerSiret = textify(identite.SIRET) || null;

  // Type de marche
  const contractType = textify(objet.TYPE_MARCHE) || textify(dig(donnees, "TYPE_MARCHE")) || null;

  // Criteres d'attribution
  const awardCriteria = textify(dig(procedure, "CRITERES_ATTRIBUTION")) 
    || textify(dig(procedure, "CRITERE_ATTRIBUTION")) || null;

  // Conditions de participation
  const participationConditions = textify(condition) || textify(dig(procedure, "CONDITION_PARTICIPATION")) || null;

  // Renseignements complementaires
  const additionalInfo = textify(dig(procedure, "RENSEIGNEMENTS_COMPLEMENTAIRES"))
    || textify(dig(donnees, "RENSEIGNEMENTS_COMPLEMENTAIRES")) || null;

  // Estimated amount
  let estimatedAmount: number | null = null;
  const montant = dig(objet, "CARACTERISTIQUES", "QUANTITE") || dig(objet, "VALEUR_ESTIMEE") || dig(objet, "MONTANT");
  if (montant) {
    const num = parseFloat(String(montant));
    if (!isNaN(num) && num > 0) estimatedAmount = num;
  }

  // Lots
  let lots: any[] = [];
  const lotsData = dig(objet, "CARACTERISTIQUES", "DIV_EN_LOTS") || dig(objet, "LOTS");
  if (Array.isArray(lotsData)) {
    lots = lotsData.map((lot: any, i: number) => ({
      numero: lot.NUM || i + 1,
      title: textify(lot.INTITULE) || textify(lot.TITRE) || `Lot ${i + 1}`,
      description: textify(lot.DESCRIPTION) || null,
      amount: lot.VALEUR ? parseFloat(String(lot.VALEUR)) || null : null,
      cpv: lot.CPV?.PRINCIPAL || null,
    }));
  }

  return {
    description,
    titreMarche,
    cpvCodes: cpvCodes.length > 0 ? cpvCodes : null,
    executionLocation,
    nutsCode,
    buyerAddress: adresse,
    buyerContact: Object.keys(buyerContact).length > 0 ? buyerContact : null,
    buyerSiret,
    contractType,
    awardCriteria,
    participationConditions,
    additionalInfo,
    estimatedAmount,
    lots: lots.length > 0 ? lots : null,
  };
}

function normalizeBoampToTender(record: any) {
  const r = record;
  
  // Parse donnees for rich data
  const rich = parseBoampDonnees(r.donnees);

  return {
    title: rich.titreMarche || r.objet || r.idweb || "Sans titre",
    reference: r.idweb,
    source: "boamp",
    source_url: r.url_avis || `https://www.boamp.fr/pages/avis/?q=idweb:${r.idweb}`,
    buyer_name: r.nomacheteur || null,
    buyer_siret: rich.buyerSiret || null,
    object: r.objet || null,
    procedure_type: r.procedure_libelle || r.type_procedure || null,
    department: r.code_departement_prestation 
      || (Array.isArray(r.code_departement) ? r.code_departement[0] : r.code_departement) 
      || null,
    region: r.perimetre || null,
    publication_date: r.dateparution || null,
    deadline: r.datelimitereponse || null,
    estimated_amount: rich.estimatedAmount || null,
    cpv_codes: rich.cpvCodes || (r.descripteur_code ? (Array.isArray(r.descripteur_code) ? r.descripteur_code : [r.descripteur_code]) : []),
    lots: rich.lots || [],
    status: "open" as const,
    updated_at: new Date().toISOString(),
    // New rich fields
    description: rich.description,
    buyer_address: rich.buyerAddress,
    buyer_contact: rich.buyerContact,
    execution_location: rich.executionLocation,
    nuts_code: rich.nutsCode,
    contract_type: rich.contractType || r.type_marche || null,
    award_criteria: rich.awardCriteria,
    participation_conditions: rich.participationConditions,
    additional_info: rich.additionalInfo,
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

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0];

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
      hasMore = offset < totalCount && offset < 1000;
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
