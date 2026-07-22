import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { parseBoampDonnees, parseBoampAward, decodeHtmlEntities, type BoampAward } from "../_shared/boampParse.ts";
import { deptToRegion, detectContractType } from "../_shared/normalize.ts";

const BOAMP_API = "https://www.boamp.fr/api/explore/v2.1/catalog/datasets/boamp/records";
const SOURCE = "BOAMP";

type BoampRecord = Record<string, unknown> & {
  idweb?: string;
  objet?: string;
  nomacheteur?: string;
  datelimitereponse?: string;
  type_avis?: string;
  procedure_libelle?: string;
  url_avis?: string;
  dateparution?: string;
  descripteur_libelle?: string | string[];
  code_departement?: string | string[];
  code_departement_prestation?: string;
  nature_libelle?: string;
  type_marche?: string | string[];
  famille?: string;
  donnees?: string;
};

function toDate(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function toDateOnly(v: unknown): string | null {
  const iso = toDate(v);
  return iso ? iso.slice(0, 10) : null;
}
function joinArr(v: unknown): string | null {
  if (v == null) return null;
  return Array.isArray(v) ? v.join(", ") : String(v);
}
// Entités HTML (« &amp; ») présentes aussi dans les champs de premier niveau
// de l'API BOAMP (objet, nomacheteur), pas seulement dans `donnees`.
function dec(s: string | null): string | null {
  return s == null ? null : decodeHtmlEntities(s);
}

function isCancellation(r: BoampRecord): boolean {
  const hay = [
    r.nature_libelle, r.famille,
    Array.isArray(r.type_marche) ? r.type_marche.join(" ") : r.type_marche,
  ].filter(Boolean).map((x) => String(x).toUpperCase()).join(" | ");
  if (/AVIS\s+D[' ]?ANNULATION|ANNULATION/.test(hay)) return true;
  const typeAvis = Array.isArray(r.type_avis) ? r.type_avis : [r.type_avis];
  if (typeAvis.some((v) => String(v) === "7")) return true;
  return false;
}

function isAttribution(r: BoampRecord): boolean {
  const nature = (r.nature_libelle ?? "").toString().toUpperCase();
  if (/R[ÉE]SULTAT|ATTRIBUTION/.test(nature)) return true;
  const typeAvis = Array.isArray(r.type_avis) ? r.type_avis : [r.type_avis];
  // BOAMP codes : 10 et 6 = Résultat de marché
  if (typeAvis.some((v) => v != null && (String(v) === "10" || String(v) === "6"))) return true;
  const raw = typeof r.donnees === "string" ? r.donnees : "";
  if (raw.includes("ContractAwardNotice")) return true;
  return false;
}

function mapRecord(r: BoampRecord) {
  const ref = r.idweb ? String(r.idweb) : (r.url_avis ? String(r.url_avis) : null);
  if (!ref) return null;

  const dept = joinArr(r.code_departement) ?? r.code_departement_prestation ?? null;
  const departmentStr = dept ? String(dept).split(",")[0].trim() : null;
  const region = deptToRegion(departmentStr);

  // Parse champ riche `donnees`
  const parsed = parseBoampDonnees(r.donnees, r.nomacheteur ? String(r.nomacheteur) : undefined);

  const natureStr = joinArr(r.type_marche) ?? r.nature_libelle ?? null;
  const contractType = detectContractType(natureStr ? String(natureStr) : null);

  const title = decodeHtmlEntities(r.objet ? String(r.objet) : parsed.description ?? "Sans titre").slice(0, 500);

  const cancelled = isCancellation(r);
  const awarded = !cancelled && isAttribution(r);
  const deadlineISO = toDate(r.datelimitereponse);
  const expired = !cancelled && !awarded && deadlineISO && new Date(deadlineISO).getTime() < Date.now() - 86400000;
  const status: "open" | "closed" | "cancelled" | "awarded" =
    cancelled ? "cancelled" : awarded ? "awarded" : expired ? "closed" : "open";

  return {
    reference: ref,
    source: SOURCE,
    title,
    object: r.objet ? decodeHtmlEntities(String(r.objet)) : parsed.description ?? null,
    description: parsed.description ?? dec(joinArr(r.descripteur_libelle)),
    buyer_name: r.nomacheteur ? decodeHtmlEntities(String(r.nomacheteur)) : parsed.buyer_contact?.nom ?? null,
    buyer_address: parsed.buyer_address ?? null,
    buyer_contact: parsed.buyer_contact ?? null,
    deadline: deadlineISO,
    publication_date: toDateOnly(r.dateparution),
    procedure_type: r.procedure_libelle ? String(r.procedure_libelle) : (r.type_avis ? String(r.type_avis) : null),
    source_url: r.url_avis ? String(r.url_avis) : null,
    dce_url: parsed.dce_url ?? null,
    department: departmentStr,
    region,
    nuts_code: parsed.nuts_code ?? null,
    execution_location: parsed.execution_location ?? null,
    contract_type: contractType ?? (natureStr ? String(natureStr) : null),
    cpv_codes: parsed.cpv_codes ?? null,
    estimated_amount: parsed.estimated_amount ?? null,
    lots: parsed.lots ?? null,
    award_criteria: parsed.award_criteria ?? null,
    participation_conditions: parsed.participation_conditions ?? null,
    additional_info: parsed.additional_info ?? null,
    status,
    enriched_data: { raw: r, _source: "boamp_api" },
  };
}

/** Construit la ligne award_notices unique (contrainte UNIQUE sur tender_id). */
function buildAwardRows(
  tenderId: string,
  ref: string,
  buyerName: string | null,
  award: BoampAward,
  noticeUrl: string | null,
  rawDonnees: unknown,
): Array<Record<string, unknown>> {
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
  return [{
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
    raw: rawDonnees && typeof rawDonnees === "object" ? rawDonnees : (rawDonnees ? { _raw: rawDonnees } : null),
  }];
}


async function fetchPage(offset: number, limit: number, sinceISODate: string, untilISODate?: string) {
  // On élargit le `select` : champs basiques + `donnees` (XML/JSON riche)
  // + métadonnées utiles (famille, type_marche). En cas de rejet d'un champ
  // par l'API on log et on retombe sur le minimum requis.
  const select = [
    "idweb", "objet", "nomacheteur", "datelimitereponse", "type_avis",
    "procedure_libelle", "url_avis", "dateparution", "descripteur_libelle",
    "code_departement", "code_departement_prestation", "nature_libelle",
    "type_marche", "famille", "donnees",
  ].join(",");

  // `until` optionnel : permet de cibler une tranche ancienne (rattrapage de
  // trous) sans buter sur le plafond offset+limit <= 10 000 d'Opendatasoft.
  const where = untilISODate
    ? `dateparution >= date'${sinceISODate}' AND dateparution <= date'${untilISODate}'`
    : `dateparution >= date'${sinceISODate}'`;
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    order_by: "dateparution desc",
    where,
    select,
  });
  const url = `${BOAMP_API}?${params.toString()}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`BOAMP API ${res.status}: ${await res.text()}`);
  return await res.json() as { total_count: number; results: BoampRecord[] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  const days = Number(url.searchParams.get("days") ?? "30");
  const untilDaysRaw = url.searchParams.get("until_days");
  const untilDays = untilDaysRaw != null ? Number(untilDaysRaw) : null;
  const maxPages = Number(url.searchParams.get("max_pages") ?? "400");
  // Pages de 25 (et non 100) : chaque avis embarque un gros champ `donnees`
  // (eForms XML→JSON, parfois >100 kB) — les lots de 100 saturaient la
  // mémoire du worker (546 WORKER_RESOURCE_LIMIT) et laissaient des trous
  // d'ingestion jamais rattrapés (mesuré : 1 455 avis manquants sur 30 j).
  const limit = Number(url.searchParams.get("page_size") ?? "25");
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const until = untilDays != null
    ? new Date(Date.now() - untilDays * 86400000).toISOString().slice(0, 10)
    : undefined;

  const startedAt = new Date().toISOString();
  // Budget-temps : arrêt propre avant la limite du runtime, résultat partiel.
  // Idempotent — l'exécution suivante (cron) reprend les mêmes journées.
  const deadline = Date.now() + 110_000;
  let fetched = 0, inserted = 0, errors = 0;
  let totalCount = 0;
  let awardsInserted = 0;

  try {
    for (let page = 0; page < maxPages; page++) {
      if (Date.now() > deadline) { console.warn(`fetch-boamp: budget temps atteint, arrêt avant page ${page}`); break; }
      // Plafond Opendatasoft : offset+limit <= 10 000. Au-delà, cibler une
      // tranche plus ancienne via ?days=&until_days=.
      if ((page + 1) * limit > 10000) { console.warn("fetch-boamp: plafond offset API (10 000) atteint"); break; }
      // Index ref → enregistrement brut, RÉINITIALISÉ à chaque page : avant, cette
      // Map était déclarée hors boucle et accumulait tous les enregistrements de
      // toutes les pages (chacun avec son gros champ `donnees`) → saturation
      // mémoire = 546 WORKER_LIMIT. Les attributions sont traitées dans la même
      // itération de page, donc le scope par page suffit.
      const rawByRef = new Map<string, BoampRecord>();
      const offset = page * limit;
      const data = await fetchPage(offset, limit, since, until);
      totalCount = data.total_count;
      const results = data.results ?? [];
      for (const r of results) {
        const ref = r.idweb ? String(r.idweb) : (r.url_avis ? String(r.url_avis) : null);
        if (ref) rawByRef.set(ref, r);
      }
      const rows = results.map(mapRecord).filter(Boolean) as ReturnType<typeof mapRecord>[];
      fetched += results.length;

      if (rows.length) {
        const refs = rows.map((r) => r!.reference);
        const { data: existing } = await supabase
          .from("tenders")
          .select("reference,status")
          .eq("source", SOURCE)
          .in("reference", refs);
        const protectedRefs = new Set(
          (existing ?? [])
            .filter((e) => e.status === "cancelled" || e.status === "awarded")
            .map((e) => e.reference),
        );

        const writable = rows.map((r) => {
          if (!r) return r;
          if (r.status === "cancelled" || r.status === "awarded") return r;
          if (protectedRefs.has(r.reference)) {
            const { status: _ignored, ...rest } = r;
            return rest as typeof r;
          }
          return r;
        });

        const { error, count } = await supabase
          .from("tenders")
          .upsert(writable as any, { onConflict: "source,reference", count: "exact", ignoreDuplicates: false });
        if (error) { errors++; console.error("upsert error", error); }
        else inserted += count ?? rows.length;

        // === Award notices ===
        const attribRows = rows.filter((r) => r && r.status === "awarded");
        if (attribRows.length > 0) {
          const attribRefs = attribRows.map((r) => r!.reference);
          const { data: idLookup } = await supabase
            .from("tenders")
            .select("id,reference,buyer_name")
            .eq("source", SOURCE)
            .in("reference", attribRefs);
          const idByRef = new Map(
            (idLookup ?? []).map((t) => [t.reference, { id: t.id as string, buyer_name: t.buyer_name as string | null }]),
          );

          const awardRows: Array<Record<string, unknown>> = [];
          const tenderIdsToReset: string[] = [];
          for (const r of attribRows) {
            const refKey = r!.reference;
            const tinfo = idByRef.get(refKey);
            if (!tinfo) continue;
            const raw = rawByRef.get(refKey);
            if (!raw) continue;
            const award = parseBoampAward(raw.donnees);
            if (!award) continue;
            const noticeUrl = raw.url_avis ? String(raw.url_avis) : null;
            let rawDonnees: unknown = raw.donnees;
            if (typeof rawDonnees === "string") {
              try { rawDonnees = JSON.parse(rawDonnees); } catch { /* keep string */ }
            }
            awardRows.push(...buildAwardRows(
              tinfo.id,
              refKey,
              tinfo.buyer_name ?? r!.buyer_name ?? null,
              award,
              noticeUrl,
              rawDonnees,
            ));
            tenderIdsToReset.push(tinfo.id);
          }

          if (tenderIdsToReset.length > 0) {
            // Remplace les anciennes lignes (toutes sources) pour idempotence.
            await supabase.from("award_notices")
              .delete()
              .in("tender_id", tenderIdsToReset);
          }
          if (awardRows.length > 0) {
            const { error: aerr } = await supabase.from("award_notices").insert(awardRows);
            if (aerr) { errors++; console.error("award_notices insert error", aerr); }
            else awardsInserted += awardRows.length;
          }
        }
      }
      if (offset + limit >= totalCount) break;
    }
  } catch (e) {
    errors++;
    console.error("fetch-boamp error", e);
  }

  return new Response(JSON.stringify({ since, until: until ?? null, fetched, inserted, awardsInserted, errors, total_count: totalCount, startedAt }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
