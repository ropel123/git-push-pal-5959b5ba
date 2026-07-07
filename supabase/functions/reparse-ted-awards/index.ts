// Re-fetch TED XML for older award_notices whose raw is empty, then re-parse.
// Idempotent. Call repeatedly until remaining = 0.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { XMLParser } from "npm:fast-xml-parser@4.4.1";
import { parseBoampAward } from "../_shared/boampParse.ts";

const TED_SEARCH_API = "https://api.ted.europa.eu/v3/notices/search";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
  isArray: () => false,
});

async function getXmlLink(publicationNumber: string): Promise<string | null> {
  const res = await fetch(TED_SEARCH_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query: `publication-number="${publicationNumber}"`,
      fields: ["publication-number", "links"],
      page: 1, limit: 1, scope: "ALL",
    }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  const hit = json?.notices?.[0];
  return hit?.links?.xml?.MUL ?? hit?.links?.xml?.FRA ?? hit?.links?.xml?.ENG ?? null;
}

async function fetchXml(url: string): Promise<unknown | null> {
  const res = await fetch(url, { headers: { Accept: "application/xml" } });
  if (!res.ok) return null;
  try { return xmlParser.parse(await res.text()); } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 200);

  // Pull notices with empty raw, join tender for publication-number
  const { data: rows, error } = await supabase
    .from("award_notices")
    .select("id, winner_name, winner_siren, awarded_amount, award_date, tenders!inner(id,reference,source)")
    .eq("source", "TED")
    .is("award_criteria", null)
    .is("offers_received", null)
    .is("winner_address", null)
    .limit(limit);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let processed = 0, updated = 0, skipped = 0, errors = 0, noXml = 0;

  async function processRow(row: any) {
    processed++;
    const tender = row.tenders;
    const ref = tender?.reference;
    if (!ref || tender?.source !== "TED") { skipped++; return; }

    let xmlLink: string | null = null;
    try { xmlLink = await getXmlLink(ref); } catch (e) { errors++; console.error("link", ref, e); return; }
    if (!xmlLink) { noXml++; return; }

    const parsed = await fetchXml(xmlLink);
    if (!parsed || typeof parsed !== "object") { noXml++; return; }

    const rootObj = parsed as Record<string, unknown>;
    const can = rootObj["ContractAwardNotice"] ?? rootObj["can:ContractAwardNotice"] ?? rootObj;
    const wrapped = { EFORMS: { ContractAwardNotice: can } };

    let award;
    try { award = parseBoampAward(wrapped); } catch (e) { errors++; console.error("parse", ref, e); return; }
    if (!award) { skipped++; return; }

    const main = award.winners[0];
    const allWinners = award.winners.map((w) => ({
      name: w.name, siren: w.siren, amount: w.amount, rank: w.rank,
      lot_id: w.lot_id, address: w.address ?? null,
      legal_form: w.legal_form ?? null, country: w.country ?? null,
    }));

    const patch: Record<string, unknown> = {
      award_criteria: award.criteria.length > 0 ? award.criteria : null,
      offers_received: award.offers_received,
      offers_admitted: award.offers_admitted,
      offers_rejected: award.offers_rejected,
      num_candidates: award.num_candidates,
      subcontracting_share: award.subcontracting_share,
      cpv_codes: award.cpv_codes,
      place_of_performance: award.place_of_performance,
      lots_awarded: allWinners.length > 0 ? allWinners : null,
      raw: parsed,
      reference: ref,
      notice_url: `https://ted.europa.eu/en/notice/-/detail/${ref}`,
      source_url: `https://ted.europa.eu/en/notice/-/detail/${ref}`,
    };
    if (!row.award_date && award.award_date) patch.award_date = award.award_date;
    if (main) {
      if (main.address) patch.winner_address = main.address;
      if (main.legal_form) patch.winner_legal_form = main.legal_form;
      if (main.country) patch.winner_country = main.country;
      if (!row.winner_name && main.name) patch.winner_name = main.name;
      if (!row.winner_siren && main.siren) patch.winner_siren = main.siren;
      if (!row.awarded_amount && main.amount) patch.awarded_amount = main.amount;
    }

    const { error: upErr } = await supabase.from("award_notices").update(patch).eq("id", row.id);
    if (upErr) { errors++; console.error("update", upErr.message); }
    else updated++;
  }

  // Process in parallel chunks of CONCURRENCY in background, respond immediately
  const CONCURRENCY = 6;
  const list = rows ?? [];
  const work = (async () => {
    for (let i = 0; i < list.length; i += CONCURRENCY) {
      await Promise.all(list.slice(i, i + CONCURRENCY).map(processRow));
    }
    console.log("reparse-ted-awards done", { processed, updated, skipped, errors, noXml });
  })();
  // @ts-ignore EdgeRuntime is available in Supabase Deno runtime
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work);

  return new Response(JSON.stringify({ started: list.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
