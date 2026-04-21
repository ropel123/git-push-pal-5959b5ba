// upsert-tenders : normalise + upsert idempotent sur (source, reference)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/cors.ts";
import {
  parseFrenchDate,
  parseAmount,
  detectDeptFromText,
  deptToRegion,
  detectContractType,
} from "../_shared/normalize.ts";

function makeReference(item: any): string {
  if (item.reference && String(item.reference).trim()) return String(item.reference).trim();
  // Fallback: hash based on source + title + buyer
  const seed = `${item._source_url}|${item.title || ""}|${item.buyer_name || ""}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  return `auto-${Math.abs(h).toString(36)}`;
}

function normalize(item: any) {
  const reference = makeReference(item);
  const deadline = parseFrenchDate(item.deadline);
  const publication_date = parseFrenchDate(item.publication_date);
  const dept = detectDeptFromText(item.location || item.buyer_name || item.title);
  const region = deptToRegion(dept);
  const estimated_amount = parseAmount(item.estimated_amount);
  const contract_type = item.contract_type || detectContractType(item.title);
  const dce_url =
    item.dce_url && /^https?:\/\//.test(item.dce_url) ? item.dce_url : item._source_url;

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
    source_url: item._source_url,
    status: "open",
    enriched_data: {
      scraped_at: new Date().toISOString(),
      platform: item._platform,
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

    let inserted = 0,
      updated = 0,
      skipped = 0;

    for (const raw of items) {
      try {
        const row = normalize(raw);
        if (!row.title || row.title === "Sans titre") {
          skipped++;
          continue;
        }
        // Check existing to merge enriched_data
        const { data: existing } = await supabase
          .from("tenders")
          .select("id, enriched_data")
          .eq("source", row.source)
          .eq("reference", row.reference)
          .maybeSingle();

        if (existing) {
          const merged = {
            ...(existing.enriched_data || {}),
            ...(row.enriched_data || {}),
          };
          const { error } = await supabase
            .from("tenders")
            .update({ ...row, enriched_data: merged })
            .eq("id", existing.id);
          if (error) {
            console.error("update error", error);
            skipped++;
          } else {
            updated++;
          }
        } else {
          const { error } = await supabase.from("tenders").insert(row);
          if (error) {
            console.error("insert error", error);
            skipped++;
          } else {
            inserted++;
          }
        }
      } catch (e) {
        console.error("normalize error", e);
        skipped++;
      }
    }

    return json({ inserted, updated, skipped, total: items.length });
  } catch (e) {
    console.error("upsert-tenders error:", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
