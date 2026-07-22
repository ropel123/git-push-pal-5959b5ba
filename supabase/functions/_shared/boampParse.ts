// Parser tolérant du champ `donnees` BOAMP.
// Couvre deux formats : national français (MAPA/OUVERT/RESTREINT...) et UBL eForms (JOUE).
// N'importe quelle clé manquante → undefined, jamais d'exception.

export interface BoampParsed {
  cpv_codes?: string[];
  estimated_amount?: number;
  lots?: Array<{ numero?: string; title?: string; description?: string; cpv?: string; amount?: number }>;
  buyer_contact?: { email?: string; tel?: string; url?: string; ville?: string; pays?: string; nom?: string };
  buyer_address?: string;
  execution_location?: string;
  nuts_code?: string;
  award_criteria?: string;
  participation_conditions?: string;
  additional_info?: string;
  description?: string;
  /** URL de la plateforme de retrait du DCE (profil acheteur), extraite de l'eForms. */
  dce_url?: string;
}

// Domaines d'éditeurs/plateformes de dématérialisation connus. Une URL pointant
// vers l'un d'eux est un lien de retrait DCE exploitable (vs. le site propre de
// l'acheteur, qu'on ignore).
const KNOWN_PLATFORM_RE =
  /(marches-publics|marches-securises|achatpublic|atexo|dematis|e-marchespublics|megalis|xmarches|synapse-entreprises|maximilien|aws-achat|klekoon|safetender|ternum|local-trust|bravosolution|ivalua|aji-france|centraledesmarches|medialex|marchesonline|eu-supply|adullact|demat)/i;

// Lien « profond » : pointe vers UNE consultation précise (identifiant en
// paramètre, jeton de page de détail, ou identifiant numérique dans le chemin)
// — par opposition à la racine/accueil de la plateforme que les acheteurs
// renseignent le plus souvent dans le champ « profil d'acheteur ».
const DEEP_URL_RE =
  /(fichecsl|consultation|detail|aoo[_-]|[?&][^\s"&=]{0,40}(id|ref|cons|code)[^\s"&=]{0,40}=|\/\d{5,})/i;

/** true si l'URL pointe vers une consultation précise (et non un accueil). */
export function isDeepPlatformUrl(u: string): boolean {
  return DEEP_URL_RE.test(u);
}

// Opérateurs de publication/dématérialisation : ils apparaissent comme
// organisation dans les avis qu'ils publient (ex. AWS France, siège à
// Seyssinet-Pariset). Leurs coordonnées ne doivent JAMAIS être présentées
// comme celles de l'acheteur — mesuré : ~16 % des fiches contaminées.
const OPERATOR_RE =
  /(aws-france|avenue\s?web\s?syst|atexo|dematis|klekoon|achatpublic|e-marchespublics|marches-securises|maximilien|local-?trust|megalis|centraledesmarches|seyssinet[-\s]?pariset|francemarches|doubletrade|interbat)/i;

/** Ajoute https:// à une URL sans schéma (ex. "www.plateforme.fr"). */
function ensureScheme(u: string): string {
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

// Le pipeline XML→JSON de BOAMP laisse des entités HTML littérales dans les
// textes et surtout dans les URLs (« &amp; » au lieu de « & ») : ~23 % des
// dce_url étaient inutilisables au clic (le paramètre devenait « amp;type= »).
// Idempotent, double-encodage (&amp;amp;) inclus.
export function decodeHtmlEntities(s: string): string {
  let out = s;
  for (let i = 0; i < 3 && out.includes("&amp;"); i++) out = out.split("&amp;").join("&");
  return out
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (m, n) => {
      const c = Number(n);
      return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : m;
    });
}

function asStr(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") return decodeHtmlEntities(v.trim()) || undefined;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object" && v && "#text" in (v as any)) {
    return asStr((v as any)["#text"]);
  }
  return undefined;
}

function asNum(v: unknown): number | undefined {
  const s = asStr(v);
  if (!s) return undefined;
  const n = Number(s.replace(/[\s\u00A0€]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

// Walk JSON and collect every value whose parent key matches one of `names` (case-insensitive substring).
function collect(node: unknown, names: string[], out: unknown[] = []): unknown[] {
  if (node == null) return out;
  if (Array.isArray(node)) {
    for (const it of node) collect(it, names, out);
    return out;
  }
  if (typeof node !== "object") return out;
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    const lk = k.toLowerCase();
    if (names.some((n) => lk.includes(n))) {
      out.push(v);
    }
    collect(v, names, out);
  }
  return out;
}

function firstStr(values: unknown[]): string | undefined {
  for (const v of values) {
    const s = asStr(v);
    if (s) return s;
  }
  return undefined;
}

function firstNum(values: unknown[]): number | undefined {
  for (const v of values) {
    const n = asNum(v);
    if (n) return n;
  }
  return undefined;
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr.filter((x): x is T => x != null && x !== "")));
}

/**
 * @param buyerNameHint Nom d'acheteur connu (champ `nomacheteur` du record
 *   BOAMP de niveau supérieur) — fiabilise le choix de l'organisation
 *   acheteuse quand l'avis en liste plusieurs.
 */
export function parseBoampDonnees(raw: unknown, buyerNameHint?: string): BoampParsed {
  let root: any = raw;
  if (typeof raw === "string") {
    try { root = JSON.parse(raw); } catch { return {}; }
  }
  if (!root || typeof root !== "object") return {};

  const out: BoampParsed = {};

  // === CPV codes ===
  // National FR : { cpv: { objet: "...", complementaires: { complementaire: "..." } } }
  // eForms : { "cbc:ItemClassificationCode": { "#text": "12345678" } }
  const cpvValues: string[] = [];
  for (const v of collect(root, ["itemclassificationcode", "cpvobjet", "cpv_objet", "codecpv", "code_cpv"])) {
    const s = asStr(v);
    if (s && /^\d{6,8}/.test(s)) cpvValues.push(s.slice(0, 8));
  }
  // national: cpv.objet / cpv.complementaires
  for (const cpvNode of collect(root, ["cpv"])) {
    if (cpvNode && typeof cpvNode === "object") {
      const o: any = cpvNode;
      const main = asStr(o.objet ?? o.principal ?? o.code);
      if (main && /^\d{6,8}/.test(main)) cpvValues.push(main.slice(0, 8));
      const comp = o.complementaires?.complementaire ?? o.complementaire;
      const arr = Array.isArray(comp) ? comp : comp ? [comp] : [];
      for (const c of arr) {
        const s = asStr(c);
        if (s && /^\d{6,8}/.test(s)) cpvValues.push(s.slice(0, 8));
      }
    }
  }
  const cpvs = uniq(cpvValues);
  if (cpvs.length) out.cpv_codes = cpvs;

  // === Montant estimé ===
  out.estimated_amount =
    firstNum(collect(root, ["estimatedoverallcontractamount", "estimatedoverallamount"])) ??
    firstNum(collect(root, ["montantestime", "montant_estime", "valeurestimee", "valeur_estimee"]));

  // === Description / objet ===
  out.description =
    firstStr(collect(root, ["resume_objet"])) ??
    firstStr(collect(root, ["description"]).filter((v) =>
      typeof v === "string" || (v && typeof v === "object" && "#text" in (v as any)))) ??
    firstStr(collect(root, ["objet"]));

  // === Contact acheteur ===
  // Un avis eForms contient PLUSIEURS organisations : l'acheteur, mais aussi
  // l'opérateur de publication (ex. AWS France). Le collect() global prenait
  // le premier nœud en ordre de document — parfois l'opérateur → contact,
  // adresse et NUTS faux. On scope donc l'extraction au nœud de
  // l'organisation acheteuse, avec garde anti-opérateur en repli.
  const nom = firstStr(collect(root, ["acheteurpublic", "nomorganisme", "nomacheteur"])) ??
    // repli sur les noms d'organisations, en écartant les opérateurs
    firstStr(
      collect(root, ["partyname"])
        .map((v: any) => asStr(v?.["cbc:Name"] ?? v?.Name))
        .filter((s): s is string => !!s && !OPERATOR_RE.test(s)),
    );
  const buyerNameForMatch = buyerNameHint || nom;

  const normName = (s?: string) =>
    (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
  const orgProbe = (o: unknown) =>
    collect(o, ["partyname", "nomorganisme", "electronicmail", "mel", "cityname", "ville"])
      .map((v: any) => asStr(v?.["cbc:Name"] ?? v))
      .filter(Boolean)
      .join(" ");
  const orgName = (o: unknown) =>
    firstStr(collect(o, ["partyname"]).map((v: any) => v?.["cbc:Name"] ?? v?.Name)) ??
    firstStr(collect(o, ["nomorganisme", "acheteurpublic"]));
  // Nœuds d'organisation « feuilles » (on écarte les conteneurs qui
  // englobent plusieurs organisations).
  const leafOrgs = collect(root, ["organization", "organisme"])
    .flatMap((o) => (Array.isArray(o) ? o : [o]))
    .filter((o): o is Record<string, unknown> => !!o && typeof o === "object" && !Array.isArray(o))
    .filter((o) => collect(o, ["organization", "organisme"]).length === 0);
  const buyerScope: unknown =
    leafOrgs.find((o) => {
      const n = orgName(o);
      return !!n && !!buyerNameForMatch &&
        (normName(n).includes(normName(buyerNameForMatch)) || normName(buyerNameForMatch).includes(normName(n)));
    }) ??
    leafOrgs.find((o) => !OPERATOR_RE.test(orgProbe(o))) ??
    root;

  const notOperator = (s?: string) => (s && !OPERATOR_RE.test(s) ? s : undefined);
  const email =
    firstStr(collect(buyerScope, ["electronicmail", "mel", "email"]).map((v) => notOperator(asStr(v)))) ??
    firstStr(collect(root, ["electronicmail", "mel", "email"]).map((v) => notOperator(asStr(v))));
  const tel = firstStr(collect(buyerScope, ["telephone", "tel"]).filter((v) =>
    typeof v === "string" || (v && typeof v === "object" && "#text" in (v as any))));
  const url = firstStr(collect(buyerScope, ["websiteuri", "urlprofilacheteur", "url"]).filter((v) => {
    const s = asStr(v); return s && /^https?:\/\//i.test(s);
  }));
  const ville =
    firstStr(collect(buyerScope, ["cityname"]).map((v) => notOperator(asStr(v)))) ??
    firstStr(collect(buyerScope, ["ville"]).map((v) => notOperator(asStr(v))));
  const pays = firstStr(collect(buyerScope, ["identificationcode"]).filter((v: any) => {
    const s = asStr(v); return s && /^[A-Z]{2,3}$/.test(s);
  }));
  if (email || tel || url || nom || ville) {
    out.buyer_contact = { email, tel, url, nom, ville, pays };
  }

  // === URL de retrait DCE (profil acheteur) ===
  // On rassemble tous les candidats d'URL : champs structurés (eForms +
  // national) PUIS toute URL présente ailleurs dans l'avis (champs non mappés,
  // texte de description — la page exacte de la consultation s'y trouve
  // parfois). On ne retient que les plateformes de dématérialisation connues,
  // ce qui exclut le site propre de l'acheteur (ex. mairie.fr).
  const fieldCandidates = collect(root, [
    "buyerprofileuri", "urlprofilacheteur", "url_profil_acheteur",
    "websiteuri", "accessurl", "uri", "url",
  ])
    .map((v) => asStr(v))
    .filter((s): s is string => !!s && /^(https?:\/\/|www\.)/i.test(s))
    .map(ensureScheme);
  const textCandidates = (JSON.stringify(root).match(/https?:\/\/[^"\\\s]+/g) ?? [])
    .map((u) => decodeHtmlEntities(u).replace(/[.,;)»]+$/, ""));
  const platformUrls = [...new Set([...fieldCandidates, ...textCandidates])]
    .filter((u) => KNOWN_PLATFORM_RE.test(u));
  // Priorité au lien profond (consultation précise) sur la racine générique :
  // avant, on prenait le premier candidat venu — souvent l'accueil de la
  // plateforme — en jetant le lien exact quand l'avis le contenait.
  out.dce_url = platformUrls.find(isDeepPlatformUrl) ?? platformUrls[0];

  // === Buyer address ===
  // Scopée sur l'organisation acheteuse (repli : reste de l'avis), avec
  // garde anti-opérateur — l'adresse du siège d'AWS France (Seyssinet-
  // Pariset) contaminait ~14 % des fiches.
  const addrScopes: unknown[] = buyerScope === root ? [root] : [buyerScope, root];
  const notOperatorNode = (v: unknown) => v && typeof v === "object" && !OPERATOR_RE.test(JSON.stringify(v));
  // national: organisme.adr.{voie.nomvoie, cp, ville}
  const adrNode: any = addrScopes
    .flatMap((s) => collect(s, ["adr"]))
    .find((v: any) => notOperatorNode(v) && ("voie" in v || "cp" in v || "ville" in v));
  if (adrNode) {
    const voie = asStr(adrNode.voie?.nomvoie ?? adrNode.voie);
    const cp = asStr(adrNode.cp);
    const v = asStr(adrNode.ville);
    out.buyer_address = [voie, cp, v].filter(Boolean).join(", ") || undefined;
  } else {
    // eForms PostalAddress
    const postal: any = addrScopes
      .flatMap((s) => collect(s, ["postaladdress"]))
      .find((v) => notOperatorNode(v));
    if (postal) {
      const street = asStr(postal["cbc:StreetName"] ?? postal.StreetName);
      const cp = asStr(postal["cbc:PostalZone"] ?? postal.PostalZone);
      const v = asStr(postal["cbc:CityName"] ?? postal.CityName);
      out.buyer_address = [street, cp, v].filter(Boolean).join(", ") || undefined;
    }
  }

  // === Lieu d'exécution + NUTS ===
  const lieu: any = collect(root, ["lieuexecution", "lieu_execution"]).find((v) => v && typeof v === "object");
  if (lieu) {
    const v = asStr(lieu.ville);
    const cp = asStr(lieu.cp);
    const voie = asStr(lieu.voie?.nomvoie ?? lieu.voie);
    out.execution_location = [voie, cp, v].filter(Boolean).join(", ") || asStr(lieu);
  }
  // NUTS : d'abord celui du lieu d'exécution, sinon celui de l'organisation
  // acheteuse — jamais le premier trouvé dans l'avis (qui pouvait être celui
  // de l'opérateur de publication, ex. FRK24/Isère pour AWS France).
  const nutsFrom = (scope: unknown) =>
    firstStr(collect(scope, ["countrysubentitycode", "nuts", "code_nuts"]).filter((v) => {
      const s = asStr(v); return s && /^FR/i.test(s);
    }));
  out.nuts_code =
    nutsFrom(collect(root, ["realizedlocation", "procurementproject", "lieuexecution", "lieu_execution"])) ??
    nutsFrom(buyerScope);

  // === Critères / conditions / infos complémentaires ===
  out.award_criteria =
    firstStr(collect(root, ["criteres", "critere_attribution", "critereattribution"])) ??
    undefined;
  out.participation_conditions =
    firstStr(collect(root, ["conditions"])) ??
    firstStr(collect(root, ["caracteristiques"]).map((v: any) => asStr(v?.principales)));
  out.additional_info =
    firstStr(collect(root, ["rensgcomplt", "renseignementscomplt", "renseignements_complementaires", "informations_complementaires", "infossup"]));

  // === Lots ===
  const lots: BoampParsed["lots"] = [];
  // national: initial.description.lots.lot[]  ou  donnees.lots
  for (const lotNode of collect(root, ["lot"])) {
    if (!lotNode) continue;
    const arr = Array.isArray(lotNode) ? lotNode : [lotNode];
    for (const l of arr) {
      if (!l || typeof l !== "object") continue;
      const o: any = l;
      const numero = asStr(o.numero ?? o.num ?? o["cbc:ID"]);
      const title = asStr(o.intitule ?? o.titre ?? o["cbc:Name"]?.["#text"] ?? o["cbc:Name"]);
      const description = asStr(o.descriptionLot ?? o.description ?? o["cbc:Description"]?.["#text"] ?? o["cbc:Description"]);
      const cpv = asStr(o.cpv?.objet ?? o.cpv ?? o["cbc:ItemClassificationCode"]?.["#text"]);
      const amount = asNum(o.montantEstime ?? o.valeur ?? o["cbc:EstimatedOverallContractAmount"]?.["#text"]);
      if (numero || title || description || cpv || amount) {
        lots.push({ numero, title, description, cpv, amount });
      }
    }
  }
  // eForms : cac:ProcurementProjectLot[]
  for (const proj of collect(root, ["procurementprojectlot"])) {
    const arr = Array.isArray(proj) ? proj : [proj];
    for (const p of arr) {
      if (!p || typeof p !== "object") continue;
      const o: any = p;
      const numero = asStr(o["cbc:ID"]?.["#text"] ?? o["cbc:ID"]);
      const proj2 = o["cac:ProcurementProject"] ?? {};
      const title = asStr(proj2["cbc:Name"]?.["#text"] ?? proj2["cbc:Name"]);
      const description = asStr(proj2["cbc:Description"]?.["#text"] ?? proj2["cbc:Description"]);
      const cpv = asStr(proj2["cac:MainCommodityClassification"]?.["cbc:ItemClassificationCode"]?.["#text"]);
      if (numero || title || description || cpv) {
        // dedupe by numero
        if (!lots.some((l) => l.numero && l.numero === numero)) {
          lots.push({ numero, title, description, cpv });
        }
      }
    }
  }
  if (lots.length) out.lots = lots;

  return out;
}

// ============================================================
// Award notice parsing (BOAMP "Résultat de marché" / ContractAwardNotice)
// ============================================================

export interface BoampAwardWinner {
  name: string;
  siren: string | null;
  amount: number | null;
  rank: number | null;
  lot_id: string | null;
  address?: string | null;
  legal_form?: string | null;
  country?: string | null;
}

export interface BoampAwardCriterion {
  name: string | null;
  weight: number | null;
  type: string | null;
}

export interface BoampAward {
  winners: BoampAwardWinner[];
  award_date: string | null;
  notification_date: string | null;
  num_candidates: number | null;
  offers_received: number | null;
  offers_admitted: number | null;
  offers_rejected: number | null;
  subcontracting_share: number | null;
  total_amount: number | null;
  parent_folder_id: string | null;
  criteria: BoampAwardCriterion[];
  cpv_codes: string[] | null;
  place_of_performance: string | null;
}


function asArr<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function digits(s: string | undefined): string | null {
  if (!s) return null;
  const d = s.replace(/\D+/g, "");
  return d.length >= 9 ? d.slice(0, 14) : null;
}

/**
 * Parse une notice d'attribution BOAMP (UBL eForms ou national FR).
 * Renvoie null si le payload n'est pas une attribution exploitable.
 */
export function parseBoampAward(raw: unknown): BoampAward | null {
  let root: any = raw;
  if (typeof raw === "string") {
    try { root = JSON.parse(raw); } catch { return null; }
  }
  if (!root || typeof root !== "object") return null;

  // 1) eForms : EFORMS.ContractAwardNotice
  const can = root?.EFORMS?.ContractAwardNotice;
  if (can) return parseEformsAward(can);

  // 2) National FR : chercher des balises TITULAIRE / NOM / SIREN
  return parseNationalAward(root);
}

function parseEformsAward(can: any): BoampAward | null {
  const ext = can?.["ext:UBLExtensions"]?.["ext:UBLExtension"]?.["ext:ExtensionContent"]
    ?.["efext:EformsExtension"];
  const noticeResult = ext?.["efac:NoticeResult"];
  const orgs = asArr<any>(ext?.["efac:Organizations"]?.["efac:Organization"]);
  const folderId = asStr(can?.["cbc:ContractFolderID"]) ?? null;
  const issueDate = asStr(can?.["cbc:IssueDate"]);
  const notificationDate = issueDate ? issueDate.slice(0, 10) : null;

  // Carte org_id → {name, siren, address, legal_form, country}
  type OrgInfo = { name: string; siren: string | null; address: string | null; legal_form: string | null; country: string | null };
  const orgMap = new Map<string, OrgInfo>();
  for (const o of orgs) {
    const company = o?.["efac:Company"];
    if (!company) continue;
    const id = asStr(company?.["cac:PartyIdentification"]?.["cbc:ID"]?.["#text"]
      ?? company?.["cac:PartyIdentification"]?.["cbc:ID"]);
    const name = asStr(company?.["cac:PartyName"]?.["cbc:Name"]?.["#text"]
      ?? company?.["cac:PartyName"]?.["cbc:Name"]);
    const siren = digits(asStr(company?.["cac:PartyLegalEntity"]?.["cbc:CompanyID"]));
    const legalForm = asStr(company?.["cac:PartyLegalEntity"]?.["cbc:CompanyLegalForm"]?.["#text"]
      ?? company?.["cac:PartyLegalEntity"]?.["cbc:CompanyLegalForm"]);
    const addr = company?.["cac:PostalAddress"];
    const street = asStr(addr?.["cbc:StreetName"]);
    const city = asStr(addr?.["cbc:CityName"]);
    const zip = asStr(addr?.["cbc:PostalZone"]);
    const country = asStr(addr?.["cac:Country"]?.["cbc:IdentificationCode"]?.["#text"]
      ?? addr?.["cac:Country"]?.["cbc:IdentificationCode"]);
    const fullAddress = [street, [zip, city].filter(Boolean).join(" ")]
      .filter((s) => s && s.trim().length > 0).join(", ") || null;
    if (id && name) orgMap.set(id, {
      name,
      siren,
      address: fullAddress,
      legal_form: legalForm ?? null,
      country: country ?? null,
    });
  }

  // Carte tendering_party_id → org_id
  const tpMap = new Map<string, string>();
  for (const tp of asArr<any>(noticeResult?.["efac:TenderingParty"])) {
    const tpId = asStr(tp?.["cbc:ID"]?.["#text"] ?? tp?.["cbc:ID"]);
    const orgId = asStr(tp?.["efac:Tenderer"]?.["cbc:ID"]?.["#text"]
      ?? tp?.["efac:Tenderer"]?.["cbc:ID"]);
    if (tpId && orgId) tpMap.set(tpId, orgId);
  }

  // Carte tender_id → {amount, rank, tendering_party_id, subcontracting_share}
  type TenderInfo = { amount: number | null; rank: number | null; tpId: string | null; subShare: number | null };
  const tenderMap = new Map<string, TenderInfo>();
  for (const lt of asArr<any>(noticeResult?.["efac:LotTender"])) {
    const id = asStr(lt?.["cbc:ID"]?.["#text"] ?? lt?.["cbc:ID"]);
    if (!id) continue;
    const amount = asNum(lt?.["cac:LegalMonetaryTotal"]?.["cbc:PayableAmount"]?.["#text"]
      ?? lt?.["cac:LegalMonetaryTotal"]?.["cbc:PayableAmount"]);
    const rank = asNum(lt?.["cbc:RankCode"]);
    const tpId = asStr(lt?.["efac:TenderingParty"]?.["cbc:ID"]?.["#text"]
      ?? lt?.["efac:TenderingParty"]?.["cbc:ID"]);
    const subShare = asNum(lt?.["efac:SubcontractingTerm"]?.["efbc:TermPercent"]
      ?? lt?.["efac:SubcontractingTerm"]?.["efbc:TermPercent"]?.["#text"]);
    tenderMap.set(id, { amount: amount ?? null, rank: rank ?? null, tpId: tpId ?? null, subShare: subShare ?? null });
  }

  // Dates + offres reçues/admises/rejetées (statistiques BOAMP eForms)
  let awardDate: string | null = null;
  let numCandidates: number | null = null;
  let offersReceived: number | null = null;
  let offersAdmitted: number | null = null;
  let offersRejected: number | null = null;
  let totalAmount: number | null = null;

  for (const sc of asArr<any>(noticeResult?.["efac:SettledContract"])) {
    const d = asStr(sc?.["cbc:AwardDate"]) ?? asStr(sc?.["cbc:IssueDate"]);
    if (d && !awardDate) awardDate = d.slice(0, 10);
  }
  for (const stat of asArr<any>(noticeResult?.["efac:LotResult"])) {
    for (const s of asArr<any>(stat?.["efac:ReceivedSubmissionsStatistics"])) {
      const code = asStr(s?.["efbc:StatisticsCode"]?.["#text"] ?? s?.["efbc:StatisticsCode"]);
      const n = asNum(s?.["efbc:StatisticsNumeric"]);
      if (!n) continue;
      // codes officiels eForms: t-esubm (electronic), tenders, t-rec (received), t-adm (admitted), t-rej (rejected)
      if ((code === "t-esubm" || code === "tenders" || code === "t-rec") && !offersReceived) offersReceived = n;
      if (code === "t-adm" && !offersAdmitted) offersAdmitted = n;
      if (code === "t-rej" && !offersRejected) offersRejected = n;
    }
  }
  numCandidates = offersReceived;
  totalAmount = asNum(noticeResult?.["cbc:TotalAmount"]?.["#text"]
    ?? noticeResult?.["efbc:OverallMaximumFrameworkContractsAmount"]?.["#text"]) ?? null;

  // Critères de notation (efac:AwardingTerms/efac:AwardingCriterion par lot)
  const criteria: BoampAwardCriterion[] = [];
  const criteriaSeen = new Set<string>();
  // chercher dans le ContractAwardNotice et dans procurementProjectLot
  const allCriteriaSources: any[] = [];
  const procLots = asArr<any>(can?.["cac:ProcurementProjectLot"]);
  for (const lot of procLots) {
    const ac = lot?.["cac:TenderingTerms"]?.["cac:AwardingTerms"]?.["cac:AwardingCriterion"]
      ?? lot?.["cac:TenderingTerms"]?.["ext:UBLExtensions"];
    if (ac) allCriteriaSources.push(ac);
    // eForms nested under SubordinateAwardingCriterion
    const sub = asArr<any>(lot?.["cac:TenderingTerms"]?.["cac:AwardingTerms"]?.["cac:AwardingCriterion"]?.["cac:SubordinateAwardingCriterion"]);
    for (const s of sub) allCriteriaSources.push(s);
  }
  for (const src of allCriteriaSources) {
    const arr = Array.isArray(src) ? src : [src];
    for (const c of arr) {
      if (!c || typeof c !== "object") continue;
      const name = asStr(c?.["cbc:Description"]?.["#text"] ?? c?.["cbc:Description"]
        ?? c?.["cbc:Name"]?.["#text"] ?? c?.["cbc:Name"]);
      const weight = asNum(c?.["cbc:WeightNumeric"]?.["#text"] ?? c?.["cbc:WeightNumeric"]
        ?? c?.["cbc:Weight"]);
      const type = asStr(c?.["cbc:AwardingCriterionTypeCode"]?.["#text"]
        ?? c?.["cbc:AwardingCriterionTypeCode"]);
      if (!name && weight == null) continue;
      const key = `${name ?? ""}|${weight ?? ""}`;
      if (criteriaSeen.has(key)) continue;
      criteriaSeen.add(key);
      criteria.push({ name: name ?? null, weight: weight ?? null, type: type ?? null });
    }
  }

  // CPV codes + lieu d'exécution
  const cpvSet = new Set<string>();
  for (const lot of procLots) {
    const pp = lot?.["cac:ProcurementProject"];
    const main = asStr(pp?.["cac:MainCommodityClassification"]?.["cbc:ItemClassificationCode"]?.["#text"]
      ?? pp?.["cac:MainCommodityClassification"]?.["cbc:ItemClassificationCode"]);
    if (main) cpvSet.add(main);
    for (const ac of asArr<any>(pp?.["cac:AdditionalCommodityClassification"])) {
      const code = asStr(ac?.["cbc:ItemClassificationCode"]?.["#text"] ?? ac?.["cbc:ItemClassificationCode"]);
      if (code) cpvSet.add(code);
    }
  }
  const ppRoot = can?.["cac:ProcurementProject"];
  if (ppRoot) {
    const main = asStr(ppRoot?.["cac:MainCommodityClassification"]?.["cbc:ItemClassificationCode"]?.["#text"]
      ?? ppRoot?.["cac:MainCommodityClassification"]?.["cbc:ItemClassificationCode"]);
    if (main) cpvSet.add(main);
  }
  const cpvCodes = cpvSet.size > 0 ? Array.from(cpvSet) : null;

  let placeOfPerformance: string | null = null;
  for (const lot of procLots) {
    const loc = lot?.["cac:ProcurementProject"]?.["cac:RealizedLocation"]?.["cac:Address"];
    const city = asStr(loc?.["cbc:CityName"]);
    const country = asStr(loc?.["cac:Country"]?.["cbc:IdentificationCode"]?.["#text"]
      ?? loc?.["cac:Country"]?.["cbc:IdentificationCode"]);
    const p = [city, country].filter(Boolean).join(", ");
    if (p && !placeOfPerformance) placeOfPerformance = p;
  }

  // Gagnants : pour chaque LotResult selec-w, lister les LotTender associés
  const winners: BoampAwardWinner[] = [];
  let globalSubShare: number | null = null;
  for (const lr of asArr<any>(noticeResult?.["efac:LotResult"])) {
    const code = asStr(lr?.["cbc:TenderResultCode"]?.["#text"] ?? lr?.["cbc:TenderResultCode"]);
    if (code && code !== "selec-w") continue;
    const lotId = asStr(lr?.["efac:TenderLot"]?.["cbc:ID"]?.["#text"]
      ?? lr?.["efac:TenderLot"]?.["cbc:ID"]) ?? null;
    for (const lt of asArr<any>(lr?.["efac:LotTender"])) {
      const tenderId = asStr(lt?.["cbc:ID"]?.["#text"] ?? lt?.["cbc:ID"]);
      if (!tenderId) continue;
      const info = tenderMap.get(tenderId);
      const tpId = info?.tpId ?? null;
      const orgId = tpId ? tpMap.get(tpId) : null;
      const org = orgId ? orgMap.get(orgId) : null;
      if (!org) continue;
      if (info?.rank && info.rank > 1) continue;
      if (info?.subShare != null && globalSubShare == null) globalSubShare = info.subShare;
      winners.push({
        name: org.name,
        siren: org.siren,
        amount: info?.amount ?? null,
        rank: info?.rank ?? null,
        lot_id: lotId,
        address: org.address,
        legal_form: org.legal_form,
        country: org.country,
      });
    }
  }

  const seen = new Set<string>();
  const uniqueWinners = winners.filter((w) => {
    const k = `${w.name}|${w.siren ?? ""}|${w.lot_id ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (uniqueWinners.length === 0 && !awardDate && !totalAmount) return null;

  return {
    winners: uniqueWinners,
    award_date: awardDate,
    notification_date: notificationDate,
    num_candidates: numCandidates,
    offers_received: offersReceived,
    offers_admitted: offersAdmitted,
    offers_rejected: offersRejected,
    subcontracting_share: globalSubShare,
    total_amount: totalAmount,
    parent_folder_id: folderId,
    criteria,
    cpv_codes: cpvCodes,
    place_of_performance: placeOfPerformance,
  };
}

function parseNationalAward(root: any): BoampAward | null {
  const winners: BoampAwardWinner[] = [];
  for (const t of collect(root, ["titulaire"])) {
    const arr = Array.isArray(t) ? t : [t];
    for (const it of arr) {
      if (!it || typeof it !== "object") continue;
      const o: any = it;
      const name = asStr(o.nom ?? o.denomination ?? o.raison_sociale);
      const siren = digits(asStr(o.siren ?? o.siret));
      const amount = asNum(o.montant ?? o.montant_attribue);
      const address = asStr(o.adresse ?? o.address) ?? null;
      if (name) {
        winners.push({
          name,
          siren: siren ?? null,
          amount: amount ?? null,
          rank: null,
          lot_id: null,
          address,
          legal_form: null,
          country: null,
        });
      }
    }
  }
  const awardDate = firstStr(collect(root, ["date_dec_att", "datedecisionattribution", "dateattribution"]));
  const numCandidates = firstNum(collect(root, ["nb_offres", "nbreoffres", "nombreoffres"]));
  const offersAdmitted = firstNum(collect(root, ["nb_offres_admises", "nboffresadmises"]));
  const offersRejected = firstNum(collect(root, ["nb_offres_rejetees", "nboffresrejetees"]));
  const totalAmount = firstNum(collect(root, ["montant_total", "montanttotal"]));
  // critères : `criteres` => [{ libelle, ponderation }]
  const criteria: BoampAwardCriterion[] = [];
  for (const block of collect(root, ["criteres", "critere"])) {
    const arr = Array.isArray(block) ? block : [block];
    for (const c of arr) {
      if (!c || typeof c !== "object") continue;
      const o: any = c;
      const name = asStr(o.libelle ?? o.intitule ?? o.nom);
      const weight = asNum(o.ponderation ?? o.poids ?? o.coefficient);
      if (name || weight != null) {
        criteria.push({ name: name ?? null, weight: weight ?? null, type: null });
      }
    }
  }
  if (!winners.length && !awardDate) return null;
  return {
    winners,
    award_date: awardDate ? awardDate.slice(0, 10) : null,
    notification_date: null,
    num_candidates: numCandidates ?? null,
    offers_received: numCandidates ?? null,
    offers_admitted: offersAdmitted ?? null,
    offers_rejected: offersRejected ?? null,
    subcontracting_share: null,
    total_amount: totalAmount ?? null,
    parent_folder_id: null,
    criteria,
    cpv_codes: null,
    place_of_performance: null,
  };
}

