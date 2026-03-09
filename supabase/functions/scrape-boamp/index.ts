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

// Check if an object has only empty-string values
function isEmptyObject(obj: any): boolean {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return false;
  const values = Object.values(obj);
  return values.length === 0 || values.every(v => v === "" || v === null || v === undefined || (typeof v === "object" && isEmptyObject(v)));
}

function textify(val: any): string | null {
  if (!val) return null;
  if (typeof val === "string") return val.trim() || null;
  if (Array.isArray(val)) return val.map(textify).filter(Boolean).join("\n") || null;
  if (typeof val === "object") {
    if (isEmptyObject(val)) return null;
    return JSON.stringify(val);
  }
  return String(val);
}

// Map French department codes to regions
const DEPT_TO_REGION: Record<string, string> = {
  "01": "Auvergne-Rhône-Alpes", "03": "Auvergne-Rhône-Alpes", "07": "Auvergne-Rhône-Alpes",
  "15": "Auvergne-Rhône-Alpes", "26": "Auvergne-Rhône-Alpes", "38": "Auvergne-Rhône-Alpes",
  "42": "Auvergne-Rhône-Alpes", "43": "Auvergne-Rhône-Alpes", "63": "Auvergne-Rhône-Alpes",
  "69": "Auvergne-Rhône-Alpes", "73": "Auvergne-Rhône-Alpes", "74": "Auvergne-Rhône-Alpes",
  "21": "Bourgogne-Franche-Comté", "25": "Bourgogne-Franche-Comté", "39": "Bourgogne-Franche-Comté",
  "58": "Bourgogne-Franche-Comté", "70": "Bourgogne-Franche-Comté", "71": "Bourgogne-Franche-Comté",
  "89": "Bourgogne-Franche-Comté", "90": "Bourgogne-Franche-Comté",
  "22": "Bretagne", "29": "Bretagne", "35": "Bretagne", "56": "Bretagne",
  "18": "Centre-Val de Loire", "28": "Centre-Val de Loire", "36": "Centre-Val de Loire",
  "37": "Centre-Val de Loire", "41": "Centre-Val de Loire", "45": "Centre-Val de Loire",
  "2A": "Corse", "2B": "Corse", "20": "Corse", "20A": "Corse", "20B": "Corse",
  "08": "Grand Est", "10": "Grand Est", "51": "Grand Est", "52": "Grand Est",
  "54": "Grand Est", "55": "Grand Est", "57": "Grand Est", "67": "Grand Est", "68": "Grand Est", "88": "Grand Est",
  "02": "Hauts-de-France", "59": "Hauts-de-France", "60": "Hauts-de-France",
  "62": "Hauts-de-France", "80": "Hauts-de-France",
  "75": "Île-de-France", "77": "Île-de-France", "78": "Île-de-France", "91": "Île-de-France",
  "92": "Île-de-France", "93": "Île-de-France", "94": "Île-de-France", "95": "Île-de-France",
  "14": "Normandie", "27": "Normandie", "50": "Normandie", "61": "Normandie", "76": "Normandie",
  "16": "Nouvelle-Aquitaine", "17": "Nouvelle-Aquitaine", "19": "Nouvelle-Aquitaine",
  "23": "Nouvelle-Aquitaine", "24": "Nouvelle-Aquitaine", "33": "Nouvelle-Aquitaine",
  "40": "Nouvelle-Aquitaine", "47": "Nouvelle-Aquitaine", "64": "Nouvelle-Aquitaine",
  "79": "Nouvelle-Aquitaine", "86": "Nouvelle-Aquitaine", "87": "Nouvelle-Aquitaine",
  "09": "Occitanie", "11": "Occitanie", "12": "Occitanie", "30": "Occitanie",
  "31": "Occitanie", "32": "Occitanie", "34": "Occitanie", "46": "Occitanie",
  "48": "Occitanie", "65": "Occitanie", "66": "Occitanie", "81": "Occitanie", "82": "Occitanie",
  "44": "Pays de la Loire", "49": "Pays de la Loire", "53": "Pays de la Loire",
  "72": "Pays de la Loire", "85": "Pays de la Loire",
  "04": "Provence-Alpes-Côte d'Azur", "05": "Provence-Alpes-Côte d'Azur",
  "06": "Provence-Alpes-Côte d'Azur", "13": "Provence-Alpes-Côte d'Azur",
  "83": "Provence-Alpes-Côte d'Azur", "84": "Provence-Alpes-Côte d'Azur",
  "971": "Guadeloupe", "972": "Martinique", "973": "Guyane", "974": "La Réunion", "976": "Mayotte",
};

function regionFromDept(dept: string | null): string | null {
  if (!dept) return null;
  const d = String(dept).trim();
  return DEPT_TO_REGION[d] || null;
}

function regionFromNuts(nuts: string | null): string | null {
  if (!nuts || !nuts.startsWith("FR")) return null;
  const nutsToRegion: Record<string, string> = {
    "FRB": "Centre-Val de Loire", "FRC": "Bourgogne-Franche-Comté",
    "FRD": "Normandie", "FRE": "Hauts-de-France", "FRF": "Grand Est",
    "FRG": "Pays de la Loire", "FRH": "Bretagne", "FRI": "Nouvelle-Aquitaine",
    "FRJ": "Occitanie", "FRK": "Auvergne-Rhône-Alpes", "FRL": "Provence-Alpes-Côte d'Azur",
    "FRM": "Corse", "FR1": "Île-de-France",
    "FRY1": "Guadeloupe", "FRY2": "Martinique", "FRY3": "Guyane", "FRY4": "La Réunion", "FRY5": "Mayotte",
  };
  // Try progressively shorter prefixes
  for (let len = Math.min(nuts.length, 4); len >= 2; len--) {
    const prefix = nuts.substring(0, len);
    if (nutsToRegion[prefix]) return nutsToRegion[prefix];
  }
  return null;
}

// ========== JUSTIFICATION LABELS (MAPA) ==========
const JUSTIF_LABELS: Record<string, string> = {
  redressementJudiciaire: "Redressement judiciaire",
  article2141: "Interdictions de soumissionner (art. L.2141)",
  travailleursHandicapes: "Emploi des travailleurs handicapés",
  salariesReguliers: "Emploi régulier des salariés",
  salariesEtranger: "Bulletins de paie (étranger)",
  chiffreAffaires: "Chiffre d'affaires",
  assuranceRisques: "Assurance risques professionnels",
  bilans: "Bilans",
  effectifs: "Effectifs moyens annuels",
  listeServices: "Liste des principales prestations",
  listeTravaux: "Liste des travaux exécutés",
  titresEtudes: "Titres d'études",
  titresEtudesCadres: "Titres d'études des cadres",
  outillage: "Outillage et équipement technique",
  descriptionEquipement: "Description de l'équipement technique",
  certificats: "Certificats de qualifications professionnelles",
  dc1: "Formulaire DC1",
  dc2: "Formulaire DC2",
  capacitesAutres: "Capacités d'autres opérateurs économiques",
  traductionFrancais: "Traduction en français",
};

// ========== EFORMS PARSER ==========
function parseEformsDonnees(donnees: any): Record<string, any> {
  const eforms = donnees?.EFORMS || donnees?.eforms;
  if (!eforms) return {};

  // Find the root notice element (ContractNotice, PriorInformationNotice, etc.)
  const noticeKey = Object.keys(eforms).find(k =>
    k.includes("Notice") || k.includes("notice")
  );
  const notice = noticeKey ? eforms[noticeKey] : eforms;

  // Helper to find nested values in XML-like structure
  function findVal(obj: any, key: string): any {
    if (!obj || typeof obj !== "object") return null;
    if (key in obj) return obj[key];
    for (const v of Object.values(obj)) {
      if (v && typeof v === "object") {
        const found = findVal(v, key);
        if (found !== null) return found;
      }
    }
    return null;
  }

  function findText(obj: any, key: string): string | null {
    const val = findVal(obj, key);
    if (!val) return null;
    if (typeof val === "string") return val.trim() || null;
    if (typeof val === "object" && val["#text"]) return String(val["#text"]).trim() || null;
    if (typeof val === "object") {
      // Try language keys
      const text = val["fra"] || val["fre"] || val["FRA"] || val["eng"] || Object.values(val).find(v => typeof v === "string" && v.trim());
      if (text) return String(text).trim();
      if (val["#text"]) return String(val["#text"]).trim();
    }
    return textify(val);
  }

  // === Organizations ===
  const orgs = findVal(notice, "efac:Organizations") || findVal(notice, "Organizations");
  const orgList = orgs ? (Array.isArray(orgs["efac:Organization"]) ? orgs["efac:Organization"] : orgs["efac:Organization"] ? [orgs["efac:Organization"]] : []) : [];
  
  // Find buyer org (first one or one with buyer role)
  const buyerOrg = orgList.length > 0 ? orgList[0] : null;
  const company = buyerOrg ? (buyerOrg["efac:Company"] || buyerOrg) : null;

  let buyerSiret: string | null = null;
  let buyerAddress: string | null = null;
  const buyerContact: Record<string, string> = {};

  if (company) {
    // SIRET/SIREN
    const companyId = findText(company, "cbc:CompanyID") || findText(company, "CompanyID");
    if (companyId) buyerSiret = companyId;

    // Contact
    const contact = findVal(company, "cac:Contact") || findVal(company, "Contact") || {};
    const email = findText(contact, "cbc:ElectronicMail") || findText(contact, "ElectronicMail");
    const tel = findText(contact, "cbc:Telephone") || findText(contact, "Telephone");
    const contactName = findText(contact, "cbc:Name") || findText(contact, "Name");
    if (email) buyerContact.email = email;
    if (tel) buyerContact.tel = tel;
    if (contactName) buyerContact.contact = contactName;

    // Address
    const addr = findVal(company, "cac:PostalAddress") || findVal(company, "PostalAddress") || {};
    const street = findText(addr, "cbc:StreetName") || findText(addr, "StreetName");
    const city = findText(addr, "cbc:CityName") || findText(addr, "CityName");
    const postal = findText(addr, "cbc:PostalZone") || findText(addr, "PostalZone");
    const addrParts = [street, postal, city].filter(Boolean);
    if (addrParts.length > 0) buyerAddress = addrParts.join(", ");
    if (city) buyerContact.ville = city;
  }

  // === Procurement Project ===
  const project = findVal(notice, "cac:ProcurementProject") || findVal(notice, "ProcurementProject") || {};
  const title = findText(project, "cbc:Name") || findText(project, "Name");
  const description = findText(project, "cbc:Description") || findText(project, "Description");
  
  // CPV
  let cpvCodes: string[] = [];
  const mainCpv = findVal(project, "cac:MainCommodityClassification") || findVal(project, "MainCommodityClassification");
  if (mainCpv) {
    const code = findText(mainCpv, "cbc:ItemClassificationCode") || findText(mainCpv, "ItemClassificationCode");
    if (code && /^\d{8}/.test(code)) cpvCodes.push(code.substring(0, 8));
  }
  const addCpvs = findVal(project, "cac:AdditionalCommodityClassification");
  if (addCpvs) {
    const cpvArr = Array.isArray(addCpvs) ? addCpvs : [addCpvs];
    for (const c of cpvArr) {
      const code = findText(c, "cbc:ItemClassificationCode") || findText(c, "ItemClassificationCode");
      if (code && /^\d{8}/.test(code)) cpvCodes.push(code.substring(0, 8));
    }
  }
  cpvCodes = [...new Set(cpvCodes)];

  // Contract type
  const contractTypeCode = findText(project, "cbc:ProcurementTypeCode") || findText(project, "ProcurementTypeCode");
  const contractTypeMap: Record<string, string> = {
    works: "Travaux", services: "Services", supplies: "Fournitures",
    "works-or-services": "Travaux ou services",
  };
  const contractType = contractTypeCode ? (contractTypeMap[contractTypeCode.toLowerCase()] || contractTypeCode) : null;

  // Execution location
  const realizedLoc = findVal(project, "cac:RealizedLocation") || findVal(project, "RealizedLocation");
  let executionLocation: string | null = null;
  let nutsCode: string | null = null;
  if (realizedLoc) {
    const loc = Array.isArray(realizedLoc) ? realizedLoc[0] : realizedLoc;
    executionLocation = findText(loc, "cbc:Description") || findText(loc, "Description");
    const locAddr = findVal(loc, "cac:Address") || findVal(loc, "Address") || {};
    nutsCode = findText(locAddr, "cbc:CountrySubentityCode") || findText(locAddr, "CountrySubentityCode");
    if (!executionLocation) {
      const city = findText(locAddr, "cbc:CityName") || findText(locAddr, "CityName");
      if (city) executionLocation = city;
    }
  }

  // === Lots ===
  let lots: any[] = [];
  const lotData = findVal(notice, "cac:ProcurementProjectLot");
  if (lotData) {
    const lotArr = Array.isArray(lotData) ? lotData : [lotData];
    lots = lotArr.map((lot: any, i: number) => {
      const lotProject = findVal(lot, "cac:ProcurementProject") || findVal(lot, "ProcurementProject") || {};
      return {
        numero: findText(lot, "cbc:ID") || findText(lot, "ID") || (i + 1),
        title: findText(lotProject, "cbc:Name") || findText(lotProject, "Name") || `Lot ${i + 1}`,
        description: findText(lotProject, "cbc:Description") || findText(lotProject, "Description") || null,
      };
    });
  }

  // === Tendering Terms (conditions) ===
  const tenderTerms = findVal(notice, "cac:TenderingTerms") || findVal(notice, "TenderingTerms") || {};
  
  // Award criteria
  const awardCritArr: string[] = [];
  const awardCrit = findVal(tenderTerms, "cac:AwardingTerms") || findVal(tenderTerms, "AwardingTerms");
  if (awardCrit) {
    const criteria = findVal(awardCrit, "cac:AwardingCriterion");
    if (criteria) {
      const critArr = Array.isArray(criteria) ? criteria : [criteria];
      for (const c of critArr) {
        const name = findText(c, "cbc:Name") || findText(c, "Name");
        const desc = findText(c, "cbc:Description") || findText(c, "Description");
        const weight = findText(c, "cbc:WeightNumeric") || findText(c, "WeightNumeric");
        if (name) {
          awardCritArr.push(weight ? `${name} (${weight}%)` : name);
        } else if (desc) {
          awardCritArr.push(desc);
        }
      }
    }
  }
  const awardCriteria = awardCritArr.length > 0 ? awardCritArr.join("\n") : null;

  // Participation conditions
  const condParts: string[] = [];
  const qualReq = findVal(tenderTerms, "cac:TendererQualificationRequest");
  if (qualReq) {
    const reqArr = Array.isArray(qualReq) ? qualReq : [qualReq];
    for (const req of reqArr) {
      const desc = findText(req, "cbc:Description") || findText(req, "Description");
      if (desc) condParts.push(desc);
    }
  }
  const participationConditions = condParts.length > 0 ? condParts.join("\n") : null;

  // Estimated amount
  let estimatedAmount: number | null = null;
  const amountVal = findText(project, "cbc:EstimatedOverallContractAmount")
    || findText(notice, "efbc:FrameworkMaximumAmount")
    || findText(project, "EstimatedOverallContractAmount");
  if (amountVal) {
    const num = parseFloat(amountVal);
    if (!isNaN(num) && num > 0) estimatedAmount = num;
  }

  // Additional info (appeal terms)
  const appealTerms = findVal(tenderTerms, "cac:AppealTerms") || findVal(tenderTerms, "AppealTerms");
  const additionalInfo = appealTerms ? textify(appealTerms) : null;

  // Procedure type
  const tenderProcess = findVal(notice, "cac:TenderingProcess") || findVal(notice, "TenderingProcess") || {};
  const procType = findText(tenderProcess, "cbc:ProcedureCode") || findText(tenderProcess, "ProcedureCode");

  return {
    description,
    titreMarche: title,
    cpvCodes: cpvCodes.length > 0 ? cpvCodes : null,
    executionLocation,
    nutsCode,
    buyerAddress,
    buyerContact: Object.keys(buyerContact).length > 0 ? buyerContact : null,
    buyerSiret,
    contractType,
    awardCriteria,
    participationConditions,
    additionalInfo,
    estimatedAmount,
    lots: lots.length > 0 ? lots : null,
    internalRef: null,
    procedureType: procType,
  };
}

// ========== STANDARD (FNSimple/MAPA) PARSER ==========
function parseBoampDonnees(raw: any): Record<string, any> {
  if (!raw) return {};

  let donnees: any = null;
  if (typeof raw === "string") {
    try { donnees = JSON.parse(raw); } catch { return {}; }
  } else {
    donnees = raw;
  }

  // Check for eForms format first
  const topKeys = Object.keys(donnees);
  if (topKeys.includes("EFORMS") || topKeys.includes("eforms")) {
    return parseEformsDonnees(donnees);
  }

  // The donnees object is wrapped in a family key (FNSimple, FNS, MAPA, etc.)
  const familyKey = Object.keys(donnees).find(k => 
    typeof donnees[k] === "object" && donnees[k] !== null
  );
  const root = familyKey ? donnees[familyKey] : donnees;

  const organisme = root?.organisme || {};
  // Use initial block, fallback to rectificatif for amendment notices
  const initial = root?.initial || {};
  const rectif = root?.rectificatif || {};
  const fb = (initBlock: any, rectBlock: any) => {
    // Return initBlock if it has data, otherwise fall back to rectBlock
    if (initBlock && typeof initBlock === "object" && !isEmptyObject(initBlock)) return initBlock;
    return rectBlock || {};
  };
  const communication = initial?.communication || rectif?.communication || {};
  const procedure = fb(initial?.procedure, rectif?.procedure);
  const natureMarche = fb(initial?.natureMarche, rectif?.natureMarche);
  const informComplementaire = fb(initial?.informComplementaire, rectif?.informComplementaire);
  const descriptionBlock = fb(initial?.description, rectif?.description);
  const justifications = fb(initial?.justifications, rectif?.justifications);
  const criteres = fb(initial?.criteres, rectif?.criteres);
  const duree = fb(initial?.duree, rectif?.duree);
  const renseignements = fb(initial?.renseignements, rectif?.renseignements);

  // Rectificatif-specific additional info (e.g. "Au lieu de 13/03 lire 20/03")
  const rectifInfo = rectif?.infosRectif ? textify(rectif.infosRectif) : null;

  // === Title ===
  const titreMarche = textify(natureMarche.intitule) 
    || textify(descriptionBlock.objet) 
    || null;

  // === Description ===
  const description = textify(natureMarche.description) 
    || textify(descriptionBlock.objet) 
    || null;

  // === Buyer SIRET ===
  const buyerSiret = textify(organisme.codeIdentificationNational) || null;

  // === Buyer address ===
  const adr = organisme.adr || {};
  const adresseArr = [
    organisme.adresse || dig(adr, "voie", "nomvoie") || textify(adr.adresse),
    organisme.cp || adr.cp,
    organisme.ville || adr.ville,
  ].filter(Boolean);
  const buyerAddress = adresseArr.length > 0 ? adresseArr.join(", ") : null;

  // === Buyer contact ===
  const buyerContact: Record<string, string> = {};
  const coord = organisme.coord || {};
  const correspondant = organisme.correspondantPRM || {};
  const email = textify(communication.adresseMailContact) 
    || textify(communication.nomContact) 
    || textify(coord.mel) 
    || null;
  if (email) buyerContact.email = email;
  const tel = textify(communication.telContact) || textify(coord.tel) || null;
  if (tel) buyerContact.tel = tel;
  const contactName = textify(correspondant.nom) || null;
  if (contactName) buyerContact.contact = contactName;
  const url = textify(communication.urlDocConsul) 
    || textify(communication.urlProfilAch) 
    || textify(organisme.urlProfilAcheteur) 
    || null;
  if (url) buyerContact.url = url;
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
  cpvCodes = [...new Set(cpvCodes)].filter(c => /^\d{8}/.test(c));

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

  // === Award criteria ===
  // FNSimple: from procedure.criteresAttrib
  // MAPA: from criteres object — if critereCDC key exists, it means "criteria in the consultation rules"
  let awardCriteria = textify(procedure.criteresAttrib) || null;
  if (!awardCriteria && criteres && typeof criteres === "object") {
    if ("critereCDC" in criteres) {
      const cdcVal = criteres.critereCDC;
      if (cdcVal && typeof cdcVal === "string" && cdcVal.trim()) {
        awardCriteria = cdcVal.trim();
      } else {
        awardCriteria = "Critères définis dans le cahier des charges (règlement de consultation)";
      }
    } else if (!isEmptyObject(criteres)) {
      awardCriteria = textify(criteres);
    }
  }

  // === Participation conditions ===
  const condParts: string[] = [];
  // FNSimple paths
  if (procedure.capaciteEcoFin) condParts.push("Capacité économique et financière : " + textify(procedure.capaciteEcoFin));
  if (procedure.capaciteTech) condParts.push("Capacités techniques : " + textify(procedure.capaciteTech));
  if (procedure.capaciteExercice) condParts.push("Capacité d'exercice : " + textify(procedure.capaciteExercice));
  
  // MAPA paths - justifications block
  if (justifications && typeof justifications === "object") {
    // First pass: collect entries with non-empty values
    for (const [key, val] of Object.entries(justifications)) {
      if (val && typeof val === "string" && val.trim()) {
        const label = JUSTIF_LABELS[key] || key;
        condParts.push(`${label} : ${val}`);
      }
    }
    // If no values but keys exist, list required document types
    if (condParts.length === 0) {
      const requiredDocs = Object.keys(justifications)
        .filter(k => k in JUSTIF_LABELS)
        .map(k => JUSTIF_LABELS[k]);
      if (requiredDocs.length > 0) {
        condParts.push("Documents requis :\n• " + requiredDocs.join("\n• "));
      }
    }
  }
  const participationConditions = condParts.length > 0 ? condParts.join("\n") : null;

  // === Additional info ===
  const additionalInfoParts: string[] = [];
  if (rectifInfo) additionalInfoParts.push(rectifInfo);
  const informText = textify(informComplementaire.autresInformComplementaire) || textify(informComplementaire);
  if (informText) additionalInfoParts.push(informText);
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

  // === Internal reference ===
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
    contractType: null,
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
  const rich = parseBoampDonnees(r.donnees);

  // Derive region from NUTS code or department, NOT from perimetre (which stores family)
  const dept = r.code_departement_prestation 
    || (Array.isArray(r.code_departement) ? r.code_departement[0] : r.code_departement) 
    || null;
  const region = regionFromNuts(rich.nutsCode) || regionFromDept(dept) || null;

  return {
    title: rich.titreMarche || r.objet || r.idweb || "Sans titre",
    reference: r.idweb,
    source: "boamp",
    source_url: r.url_avis || `https://www.boamp.fr/pages/avis/?q=idweb:${r.idweb}`,
    buyer_name: r.nomacheteur || null,
    buyer_siret: rich.buyerSiret || null,
    object: r.objet || null,
    procedure_type: rich.procedureType || r.procedure_libelle || r.type_procedure || null,
    department: dept,
    region,
    publication_date: r.dateparution || null,
    deadline: r.datelimitereponse || null,
    estimated_amount: rich.estimatedAmount || null,
    cpv_codes: rich.cpvCodes || (r.descripteur_code ? (Array.isArray(r.descripteur_code) ? r.descripteur_code : [r.descripteur_code]).filter((c: any) => /^\d{8}$/.test(String(c))) : []),
    lots: rich.lots || [],
    status: "open" as const,
    updated_at: new Date().toISOString(),
    description: rich.description,
    buyer_address: rich.buyerAddress,
    buyer_contact: rich.buyerContact,
    execution_location: rich.executionLocation,
    nuts_code: rich.nutsCode,
    contract_type: rich.contractType || (Array.isArray(r.type_marche) ? r.type_marche[0] : r.type_marche) || null,
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
