// TED (Tenders Electronic Daily) - eForms award notices fetcher
// Récupère les avis d'attribution depuis l'API TED v3 pour les marchés
// publics français (place-of-performance country=FRA), parse l'XML eForms
// avec fast-xml-parser puis réutilise parseBoampAward (les deux sources
// utilisent le même standard eForms SDK).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { XMLParser } from "npm:fast-xml-parser@4.4.1";
import { parseBoampAward, type BoampAward } from "../_shared/boampParse.ts";

const TED_SEARCH_API = "https://api.ted.europa.eu/v3/notices/search";
const SOURCE = "TED";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
  isArray: () => false,
});

type TedSearchHit = {
  "publication-number"?: string;
  "notice-title"?: { fra?: string; eng?: string } | string;
  "buyer-name"?: { fra?: string; eng?: string }[] | string;
  "publication-date"?: string;
  "notice-type"?: string;
  "links"?: { xml?: { MUL?: string; FRA?: string; ENG?: string } };
};

type TedSearchResponse = {
  notices?: TedSearchHit[];
  totalNoticeCount?: number;
};

async function searchTed(sinceISODate: string, pageNum: number, pageSize: number): Promise<TedSearchResponse> {
  // form-type=result : avis d'attribution (eForms + F03/F06 legacy)
  // buyer-country=FRA : acheteurs français
  const query = [
    `form-type="result"`,
    `buyer-country="FRA"`,
    `publication-date>=${sinceISODate.replace(/-/g, "")}`,
  ].join(" AND ");



  const body = {
    query,
    fields: [
      "publication-number",
      "notice-title",
      "buyer-name",
      "publication-date",
      "notice-type",
      "links",
    ],
    page: pageNum,
    limit: pageSize,
    scope: "ALL",
  };

  const res = await fetch(TED_SEARCH_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`TED search ${res.status}: ${await res.text()}`);
  return await res.json() as TedSearchResponse;
}

async function fetchNoticeXml(xmlUrl: string): Promise<unknown | null> {
  const res = await fetch(xmlUrl, { headers: { Accept: "application/xml" } });
  if (!res.ok) {
    console.warn(`TED XML ${res.status} for ${xmlUrl}`);
    return null;
  }
  const xml = await res.text();
  try {
    return xmlParser.parse(xml);
  } catch (e) {
    console.warn(`TED XML parse error for ${xmlUrl}`, e);
    return null;
  }
}

function pickLocalized(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    for (const x of v) {
      const s = pickLocalized(x);
      if (s) return s;
    }
    return null;
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return (o.fra as string) || (o.eng as string) || (Object.values(o).find((x) => typeof x === "string") as string) || null;
  }
  return null;
}

function buildTedUrl(publicationNumber: string): string {
  // URL publique TED Tenders Electronic Daily
  return `https://ted.europa.eu/en/notice/-/detail/${publicationNumber}`;
}

function tedTenderRow(hit: TedSearchHit, parsedXml: unknown | null) {
  const ref = hit["publication-number"];
  if (!ref) return null;
  const title = pickLocalized(hit["notice-title"]) ?? "Avis TED";
  const buyer = pickLocalized(hit["buyer-name"]);
  const pubDate = hit["publication-date"]?.slice(0, 10) ?? null;
  return {
    reference: ref,
    source: SOURCE,
    title: title.slice(0, 500),
    object: title,
    buyer_name: buyer,
    publication_date: pubDate,
    source_url: buildTedUrl(ref),
    status: "awarded" as const,
    enriched_data: { _source: "ted_api", parsed: parsedXml ? true : false },
  };
}

function buildAwardRow(
  tenderId: string,
  ref: string,
  buyerName: string | null,
  award: BoampAward,
  noticeUrl: string,
  rawJson: unknown,
) {
  const main = award.winners[0];
  const allWinners = award.winners.map((w) => ({
    name: w.name,
    siren: w.siren,
    amount: w.amount,
    rank: w.rank,
    lot_id: w.lot_id,
    address: w.address ?? null,
    legal_form: w.legal_form ?? null,
    country: w.country ?? null,
  }));
  return {
    tender_id: tenderId,
    source: SOURCE,
    reference: ref,
    buyer_name: buyerName,
    award_date: award.award_date,
    notification_date: award.notification_date,
    num_candidates: award.num_candidates,
    offers_received: award.offers_received,
    offers_admitted: award.offers_admitted,
    offers_rejected: award.offers_rejected,
    subcontracting_share: award.subcontracting_share,
    winner_name: main?.name ?? null,
    winner_siren: main?.siren ?? null,
    winner_address: main?.address ?? null,
    winner_legal_form: main?.legal_form ?? null,
    winner_country: main?.country ?? null,
    awarded_amount: main?.amount ?? award.total_amount ?? null,
    award_criteria: award.criteria.length > 0 ? award.criteria : null,
    cpv_codes: award.cpv_codes,
    place_of_performance: award.place_of_performance,
    notice_url: noticeUrl,
    source_url: noticeUrl,
    lots_awarded: allWinners.length > 0 ? allWinners : null,
    raw: rawJson && typeof rawJson === "object" ? rawJson : null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  const days = Number(url.searchParams.get("days") ?? "7");
  const maxPages = Number(url.searchParams.get("max_pages") ?? "5");
  const pageSize = Number(url.searchParams.get("page_size") ?? "50");
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  const startedAt = new Date().toISOString();
  // Budget-temps : on s'arrête proprement avant la limite edge (~150s) et on
  // renvoie un résultat partiel (idempotent : la prochaine exécution reprend).
  const deadline = Date.now() + 120_000;
  let fetched = 0, tendersUpserted = 0, awardsInserted = 0, errors = 0;
  let totalCount = 0;

  try {
    for (let page = 1; page <= maxPages; page++) {
      if (Date.now() > deadline) { console.warn(`fetch-ted: budget temps atteint, arrêt avant page ${page}`); break; }
      let resp: TedSearchResponse;
      try {
        resp = await searchTed(since, page, pageSize);
      } catch (e) {
        errors++;
        console.error(`TED search page ${page}`, e);
        break;
      }
      totalCount = resp.totalNoticeCount ?? totalCount;
      const hits = resp.notices ?? [];
      if (hits.length === 0) break;
      fetched += hits.length;

      // 1) Upsert minimal tenders pour avoir un id
      const tenderRows = hits.map((h) => tedTenderRow(h, null)).filter(Boolean) as Array<ReturnType<typeof tedTenderRow>>;
      if (tenderRows.length === 0) continue;

      const { error: upErr } = await supabase.from("tenders")
        .upsert(tenderRows as any, { onConflict: "source,reference", ignoreDuplicates: false });
      if (upErr) { errors++; console.error("tender upsert", upErr); continue; }
      tendersUpserted += tenderRows.length;

      // 2) Récup ids
      const refs = tenderRows.map((r) => r!.reference);
      const { data: idLookup } = await supabase.from("tenders")
        .select("id,reference,buyer_name")
        .eq("source", SOURCE)
        .in("reference", refs);
      const idByRef = new Map((idLookup ?? []).map((t) => [t.reference, { id: t.id as string, buyer_name: t.buyer_name as string | null }]));

      // 3) Fetch XML + parse + insert award_notices
      const awardRows: Array<Record<string, unknown>> = [];
      const tenderIdsToReset: string[] = [];

      // Ne garder que les avis résolvables (id connu + lien XML), puis récupérer
      // les XML par lots concurrents. Avant : 1 fetch séquentiel par avis (~500
      // requêtes en série) = cause du timeout 504.
      const resolvable = hits
        .map((hit) => {
          const ref = hit["publication-number"];
          const tinfo = ref ? idByRef.get(ref) : undefined;
          const xmlLink = hit.links?.xml?.MUL ?? hit.links?.xml?.FRA ?? hit.links?.xml?.ENG;
          return tinfo && ref && xmlLink ? { ref, tinfo, xmlLink } : null;
        })
        .filter((x): x is { ref: string; tinfo: { id: string; buyer_name: string | null }; xmlLink: string } => x !== null);

      // Incrémental : sauter les avis dont l'attribution est déjà en base.
      // Sans ça, chaque run re-téléchargeait les XML des mêmes premières pages
      // et le budget-temps expirait avant d'atteindre la fin de la fenêtre —
      // mesuré : ~50 % des attributions TED de la semaine jamais traitées.
      const { data: existingAwards } = await supabase.from("award_notices")
        .select("reference")
        .eq("source", SOURCE)
        .in("reference", resolvable.map((r) => r.ref));
      const alreadyDone = new Set((existingAwards ?? []).map((a) => a.reference as string));
      const todo = resolvable.filter((r) => !alreadyDone.has(r.ref));

      const XML_CONCURRENCY = 8;
      for (let i = 0; i < todo.length; i += XML_CONCURRENCY) {
        if (Date.now() > deadline) break;
        const chunk = todo.slice(i, i + XML_CONCURRENCY);
        const parsedChunk = await Promise.all(chunk.map((c) => fetchNoticeXml(c.xmlLink)));
        for (let j = 0; j < chunk.length; j++) {
          const parsed = parsedChunk[j];
          if (!parsed) continue;
          const { ref, tinfo } = chunk[j];
          // L'XML TED a une racine ContractAwardNotice. Adapter pour parseBoampAward
          // qui attend root.EFORMS.ContractAwardNotice. On wrap.
          const rootObj = parsed as Record<string, unknown>;
          const can = rootObj["ContractAwardNotice"] ?? rootObj["can:ContractAwardNotice"] ?? rootObj;
          const wrapped = { EFORMS: { ContractAwardNotice: can } };
          const award = parseBoampAward(wrapped);
          if (!award) continue;
          const noticeUrl = buildTedUrl(ref);
          awardRows.push(buildAwardRow(
            tinfo.id,
            ref,
            tinfo.buyer_name ?? null,
            award,
            noticeUrl,
            parsed,
          ));
          tenderIdsToReset.push(tinfo.id);
        }
      }

      if (tenderIdsToReset.length > 0) {
        await supabase.from("award_notices").delete().in("tender_id", tenderIdsToReset);
      }
      if (awardRows.length > 0) {
        const { error: aerr } = await supabase.from("award_notices").insert(awardRows);
        if (aerr) { errors++; console.error("award insert", aerr); }
        else awardsInserted += awardRows.length;
      }

      if (hits.length < pageSize) break;
    }
  } catch (e) {
    errors++;
    console.error("fetch-ted fatal", e);
  }

  return new Response(JSON.stringify({
    since, fetched, tendersUpserted, awardsInserted, errors, total_count: totalCount, startedAt,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
