// upsert-tenders : normalise + upsert idempotent batch sur (source, reference)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/cors.ts";
import {
  parseFrenchDate,
  parseAmount,
  detectDeptFromText,
  deptToRegion,
  detectContractType,
} from "../_shared/normalize.ts";

function cleanReference(s: string): string {
  return s
    .replace(/^\s*(réf\.?|ref\.?|référence|reference|n°|numéro|num\.?)\s*[:°\-–]?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function makeReference(item: any): string {
  if (item.reference && String(item.reference).trim()) {
    const cleaned = cleanReference(String(item.reference));
    if (cleaned) return cleaned;
  }
  const seed = `${item._source_url}|${item.title || ""}|${item.buyer_name || ""}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  return `auto-${Math.abs(h).toString(36)}`;
}

const GENERIC_LINK_PATTERNS: RegExp[] = [
  /fuseaction=pub\.affResultats(?![^#]*[?&]ref(Pub|Cons|Consult)=)/i,
  /fuseaction=pub\.affPublication(?![^#]*[?&]ref(Pub|Cons|Consult)=)/i,
  /EntrepriseAdvancedSearch/i,
  /[?&]AllCons\b/i,
  /page=recherche/i,
];

function isGenericListingUrl(u: string): boolean {
  return GENERIC_LINK_PATTERNS.some((re) => re.test(u));
}

function normalize(item: any) {
  const reference = makeReference(item);
  const deadline = parseFrenchDate(item.deadline);
  const publication_date = parseFrenchDate(item.publication_date);
  const dept = detectDeptFromText(item.location || item.buyer_name || item.title);
  const region = deptToRegion(dept);
  const estimated_amount = parseAmount(item.estimated_amount);
  const contract_type = item.contract_type || detectContractType(item.title);

  const listing_url: string = item._source_url || "";
  const raw_item_link: string | null =
    item.dce_url && /^https?:\/\//.test(item.dce_url) ? item.dce_url : null;

  let item_link: string | null = null;
  let item_link_rejected_reason: string | null = null;
  if (raw_item_link) {
    if (isGenericListingUrl(raw_item_link)) {
      item_link_rejected_reason = "generic listing url (no consultation id)";
    } else {
      try {
        const itemHost = new URL(raw_item_link).hostname.toLowerCase();
        const listingHost = listing_url ? new URL(listing_url).hostname.toLowerCase() : "";
        const BLOCKED_PUBLISHERS = ["boamp.fr", "ted.europa.eu"];
        if (BLOCKED_PUBLISHERS.some((d) => itemHost.endsWith(d))) {
          item_link_rejected_reason = `blocked publisher (${itemHost})`;
        } else {
          const FEDERATED = ["marches-publics.gouv.fr"];
          const isFederated = FEDERATED.some((d) => itemHost.endsWith(d));
          const sameHost =
            listingHost &&
            (itemHost === listingHost ||
              itemHost.endsWith(`.${listingHost}`) ||
              listingHost.endsWith(`.${itemHost}`));
          if (sameHost || isFederated || !listingHost) {
            item_link = raw_item_link;
          } else {
            item_link_rejected_reason = `cross-domain ${itemHost} vs ${listingHost}`;
          }
        }
      } catch {
        item_link_rejected_reason = "invalid url";
      }
    }
  }

  const dce_url = item_link;
  const source_url = item_link;

  return {
    source: `scrape:${item._platform || "custom"}`,
    reference,
    title: String(item.title || "Sans titre").slice(0, 1000),
    description: item.description || null,
    object: item.title || null,
    buyer_name: item.buyer_name || null,
    deadline,
    publication_date: publication_date ? publication_date.slice(0, 10) : null,
    contract_type,
    procedure_type: item.procedure_type || null,
    estimated_amount,
    department: dept,
    region,
    execution_location: item.location || null,
    dce_url,
    source_url,
    status: "open",
    enriched_data: {
      scraped_at: new Date().toISOString(),
      platform: item._platform,
      listing_url,
      item_link_rejected_reason,
      raw: item,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const items: any[] = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) return json({ inserted: 0, updated: 0, skipped: 0 });

    // 1) Normalize + dedupe in-memory (last write wins on same key)
    const normalized: ReturnType<typeof normalize>[] = [];
    let skipped = 0;
    const byKey = new Map<string, ReturnType<typeof normalize>>();
    for (const raw of items) {
      try {
        const row = normalize(raw);
        if (!row.title || row.title === "Sans titre") {
          skipped++;
          continue;
        }
        byKey.set(`${row.source}::${row.reference}`, row);
      } catch (e) {
        console.error("normalize error", e);
        skipped++;
      }
    }
    for (const r of byKey.values()) normalized.push(r);
    if (normalized.length === 0) {
      return json({ inserted: 0, updated: 0, skipped, total: items.length });
    }

    // 2) Pre-fetch existing rows in 1 query to merge enriched_data
    const sources = Array.from(new Set(normalized.map((r) => r.source)));
    const refs = Array.from(new Set(normalized.map((r) => r.reference)));
    const { data: existingRows, error: fetchErr } = await supabase
      .from("tenders")
      .select("id, source, reference, enriched_data")
      .in("source", sources)
      .in("reference", refs);
    if (fetchErr) console.error("prefetch error", fetchErr);

    const existingMap = new Map<string, { id: string; enriched_data: any }>();
    for (const r of existingRows ?? []) {
      existingMap.set(`${r.source}::${r.reference}`, { id: r.id, enriched_data: r.enriched_data });
    }

    // 3) Merge enriched_data and build final rows
    const finalRows = normalized.map((row) => {
      const ex = existingMap.get(`${row.source}::${row.reference}`);
      if (ex) {
        return { ...row, enriched_data: { ...(ex.enriched_data || {}), ...(row.enriched_data || {}) } };
      }
      return row;
    });

    const existingCount = finalRows.filter((r) => existingMap.has(`${r.source}::${r.reference}`)).length;
    const newCount = finalRows.length - existingCount;

    // 4) Single batch upsert
    const { error: upsertErr } = await supabase
      .from("tenders")
      .upsert(finalRows, { onConflict: "source,reference", ignoreDuplicates: false });

    if (upsertErr) {
      console.error("batch upsert error", upsertErr);
      return json({ error: upsertErr.message, inserted: 0, updated: 0, skipped: skipped + finalRows.length }, 500);
    }

    return json({
      inserted: newCount,
      updated: existingCount,
      skipped,
      total: items.length,
    });
  } catch (e) {
    console.error("upsert-tenders error:", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
