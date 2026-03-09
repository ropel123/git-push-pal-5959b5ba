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
  if (!raw) return {};

  let donnees: any = null;
  if (typeof raw === "string") {
    try { donnees = JSON.parse(raw); } catch { return {}; }
  } else {
    donnees = raw;
  }

  // The donnees object is wrapped in a family key (FNSimple, FNS, MAPA, etc.)
  const familyKey = Object.keys(donnees).find(k => 
    typeof donnees[k] === "object" && donnees[k] !== null
  );
  const root = familyKey ? donnees[familyKey] : donnees;

  const organisme = root?.organisme || {};
  const initial = root?.initial || {};
  const communication = initial?.communication || {};
  const procedure = initial?.procedure || {};
  const natureMarche = initial?.natureMarche || {};
  const informComplementaire = initial?.informComplementaire || {};
  const descriptionBlock = initial?.description || {};
  const justifications = initial?.justifications || {};
  const criteres = initial?.criteres || {};
  const duree = initial?.duree || {};
  const renseignements = initial?.renseignements || {};

  // === Title (FNSimple: natureMarche.intitule, MAPA: description.objet) ===
  const titreMarche = textify(natureMarche.intitule) 
    || textify(descriptionBlock.objet) 
    || null;

  // === Description (FNSimple: natureMarche.description, MAPA: description.objet) ===
  const description = textify(natureMarche.description) 
    || textify(descriptionBlock.objet) 
    || null;

  // === Buyer SIRET (FNSimple only) ===
  const buyerSiret = textify(organisme.codeIdentificationNational) || null;

  // === Buyer address ===
  // FNSimple: organisme.adresse/cp/ville
  // MAPA: organisme.adr.voie.nomvoie / adr.cp / adr.ville
  const adr = organisme.adr || {};
  const adresseArr = [
    organisme.adresse || dig(adr, "voie", "nomvoie") || textify(adr.adresse),
    organisme.cp || adr.cp,
    organisme.ville || adr.ville,
  ].filter(Boolean);
  const buyerAddress = adresseArr.length > 0 ? adresseArr.join(", ") : null;

  // === Buyer contact (multi-path) ===
  const buyerContact: Record<string, string> = {};
  const coord = organisme.coord || {};
  const correspondant = organisme.correspondantPRM || {};

  // Email
  const email = textify(communication.adresseMailContact) 
    || textify(communication.nomContact) 
    || textify(coord.mel) 
    || null;
  if (email) buyerContact.email = email;

  // Phone
  const tel = textify(communication.telContact) || textify(coord.tel) || null;
  if (tel) buyerContact.tel = tel;

  // Contact name
  const contactName = textify(correspondant.nom) || null;
  if (contactName) buyerContact.contact = contactName;

  // URL
  const url = textify(communication.urlDocConsul) 
    || textify(communication.urlProfilAch) 
    || textify(organisme.urlProfilAcheteur) 
    || null;
  if (url) buyerContact.url = url;

  // City
  const ville = organisme.ville || adr.ville || null;
  if (ville) buyerContact.ville = String(ville);

  // === CPV codes ===
  let cpvCodes: string[] = [];
  const cpvData = dig(natureMarche, "codeCPV", "objetPrincipal", "classPrincipale");
  if (cpvData) {
    cpvCodes = Array.isArray(cpvData) ? cpvData.map(String) : [String(cpvData)];
  }
  const cpvSecondaire = dig(natureMarche, "codeCPV", "objetSecondaire");
  if (Array.isArray(cpvSecondaire)) {
    cpvCodes.push(...cpvSecondaire.map((c: any) => String(c?.classPrincipale || c)).filter(Boolean));
  }
  cpvCodes = [...new Set(cpvCodes)];

  // === Execution location ===
  const lieuExec = natureMarche.lieuExecution;
  let executionLocation: string | null = null;
  let nutsCode: string | null = null;
  if (lieuExec) {
    if (typeof lieuExec === "string") {
      executionLocation = lieuExec;
    } else {
      executionLocation = textify(lieuExec.libelle) || textify(lieuExec.lieu) || textify(lieuExec) || null;
      nutsCode = textify(lieuExec.codeNuts) || textify(lieuExec.code_nuts) || null;
    }
  }

  // === Award criteria (FNSimple: procedure.criteresAttrib, MAPA: criteres) ===
  const awardCriteria = textify(procedure.criteresAttrib) 
    || textify(criteres.critereCDC)
    || textify(criteres) 
    || null;

  // === Participation conditions ===
  const condParts: string[] = [];
  // FNSimple paths
  if (procedure.capaciteEcoFin) condParts.push("Capacité économique et financière : " + textify(procedure.capaciteEcoFin));
  if (procedure.capaciteTech) condParts.push("Capacités techniques : " + textify(procedure.capaciteTech));
  if (procedure.capaciteExercice) condParts.push("Capacité d'exercice : " + textify(procedure.capaciteExercice));
  // MAPA paths - justifications block
  if (justifications) {
    const justifText = textify(justifications);
    if (justifText && condParts.length === 0) condParts.push(justifText);
  }
  const participationConditions = condParts.length > 0 ? condParts.join("\n") : null;

  // === Additional info ===
  const additionalInfoParts: string[] = [];
  const informText = textify(informComplementaire.autresInformComplementaire) || textify(informComplementaire);
  if (informText) additionalInfoParts.push(informText);
  // MAPA: duration info
  if (duree.dateACompterDu || duree.jusquau) {
    const dureeParts = [];
    if (duree.dateACompterDu) dureeParts.push("À compter du : " + duree.dateACompterDu);
    if (duree.jusquau) dureeParts.push("Jusqu'au : " + duree.jusquau);
    additionalInfoParts.push(dureeParts.join(" — "));
  }
  const additionalInfo = additionalInfoParts.length > 0 ? additionalInfoParts.join("\n") : null;

  // === Estimated amount ===
  let estimatedAmount: number | null = null;
  const descText = description || "";
  if (descText) {
    const match = descText.match(/([\d\s]+[,.][\d]{2})\s*euro/i) 
      || descText.match(/([\d\s]+)\s*euro/i);
    if (match) {
      const num = parseFloat(match[1].replace(/\s/g, "").replace(",", "."));
      if (!isNaN(num) && num > 0) estimatedAmount = num;
    }
  }

  // === Lots ===
  let lots: any[] = [];
  const lotsData = natureMarche.lotsMarche;
  if (Array.isArray(lotsData)) {
    lots = lotsData.map((lot: any, i: number) => ({
      numero: lot.numero || lot.num || i + 1,
      title: textify(lot.intitule) || textify(lot.titre) || `Lot ${i + 1}`,
      description: textify(lot.description) || null,
      cpv: dig(lot, "codeCPV", "objetPrincipal", "classPrincipale") || null,
    }));
  }

  // === Internal reference (MAPA: renseignements.idMarche) ===
  const internalRef = textify(communication.identifiantInterne) || textify(renseignements.idMarche) || null;

  return {
    description,
    titreMarche,
    cpvCodes: cpvCodes.length > 0 ? cpvCodes : null,
    executionLocation,
    nutsCode,
    buyerAddress,
    buyerContact: Object.keys(buyerContact).length > 0 ? buyerContact : null,
    buyerSiret,
    contractType: null, // handled from top-level in normalizeBoampToTender
    awardCriteria,
    participationConditions,
    additionalInfo,
    estimatedAmount,
    lots: lots.length > 0 ? lots : null,
    internalRef,
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
