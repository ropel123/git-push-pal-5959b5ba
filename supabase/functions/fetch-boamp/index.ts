import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BOAMP_API = "https://www.boamp.fr/api/explore/v2.1/catalog/datasets/boamp/records";
const SOURCE = "BOAMP";
const SOURCING_URL_KEY = "https://www.boamp.fr/api/explore/v2.1/catalog/datasets/boamp";

type BoampRecord = Record<string, unknown> & {
  idweb?: string;
  objet?: string;
  acheteur?: string;
  montant?: string | number;
  datelimitereponse?: string;
  typeavis?: string;
  typeavis_libelle?: string;
  urlboamp?: string;
  dateparution?: string;
  descripteur_libelle?: string | string[];
  lieu_execution?: string | string[];
  nature_libelle?: string;
};

function toNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function toDate(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function toDateOnly(v: unknown): string | null {
  const iso = toDate(v);
  return iso ? iso.slice(0, 10) : null;
}

function mapRecord(r: BoampRecord) {
  const ref = r.idweb ? String(r.idweb) : (r.urlboamp ? String(r.urlboamp) : null);
  if (!ref) return null;
  const lieu = Array.isArray(r.lieu_execution) ? r.lieu_execution.join(", ") : (r.lieu_execution ?? null);
  const descripteurs = Array.isArray(r.descripteur_libelle) ? r.descripteur_libelle.join(", ") : (r.descripteur_libelle ?? null);
  return {
    reference: ref,
    source: SOURCE,
    title: (r.objet ? String(r.objet) : "Sans titre").slice(0, 500),
    object: r.objet ? String(r.objet) : null,
    buyer_name: r.acheteur ? String(r.acheteur) : null,
    estimated_amount: toNumber(r.montant),
    deadline: toDate(r.datelimitereponse),
    publication_date: toDateOnly(r.dateparution),
    procedure_type: r.typeavis_libelle ? String(r.typeavis_libelle) : (r.typeavis ? String(r.typeavis) : null),
    source_url: r.urlboamp ? String(r.urlboamp) : null,
    execution_location: lieu ? String(lieu) : null,
    contract_type: r.nature_libelle ? String(r.nature_libelle) : null,
    description: descripteurs ? String(descripteurs) : null,
    status: "open" as const,
    // On expose explicitement l'URL de l'avis BOAMP comme listing de repli : elle
    // résout toujours et sert de lien DCE garanti côté UI quand aucun lien de
    // plateforme de retrait direct n'est disponible.
    enriched_data: { raw: r, _source: "boamp_api", listing_url: r.urlboamp ? String(r.urlboamp) : null },
  };
}

async function fetchPage(offset: number, limit: number, sinceISODate: string) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    order_by: "dateparution desc",
    where: `dateparution >= date'${sinceISODate}'`,
    select: "idweb,objet,acheteur,montant,datelimitereponse,typeavis,typeavis_libelle,urlboamp,dateparution,descripteur_libelle,lieu_execution,nature_libelle",
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
  const maxPages = Number(url.searchParams.get("max_pages") ?? "50");
  const limit = 100;
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  const startedAt = new Date().toISOString();
  let fetched = 0, inserted = 0, errors = 0;
  let totalCount = 0;

  try {
    for (let page = 0; page < maxPages; page++) {
      const offset = page * limit;
      const data = await fetchPage(offset, limit, since);
      totalCount = data.total_count;
      const rows = (data.results ?? []).map(mapRecord).filter(Boolean) as ReturnType<typeof mapRecord>[];
      fetched += data.results?.length ?? 0;

      if (rows.length) {
        const { error, count } = await supabase
          .from("tenders")
          .upsert(rows as any, { onConflict: "source,reference", count: "exact", ignoreDuplicates: false });
        if (error) { errors++; console.error("upsert error", error); }
        else inserted += count ?? rows.length;
      }
      if (offset + limit >= totalCount) break;
    }
  } catch (e) {
    errors++;
    console.error("fetch-boamp error", e);
  }

  await supabase.from("sourcing_urls")
    .update({
      last_run_at: new Date().toISOString(),
      last_status: errors === 0 ? "success" : "error",
      last_items_found: fetched,
      last_items_inserted: inserted,
      last_error: errors === 0 ? null : `${errors} error(s) — see logs`,
    })
    .eq("url", SOURCING_URL_KEY);

  return new Response(JSON.stringify({ since, fetched, inserted, errors, total_count: totalCount, startedAt }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
