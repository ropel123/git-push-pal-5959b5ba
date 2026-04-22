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
  // Fallback: hash based on source + title + buyer
  const seed = `${item._source_url}|${item.title || ""}|${item.buyer_name || ""}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  return `auto-${Math.abs(h).toString(36)}`;
}

// Patterns d'URL "page de listing/résultats" (sans identifiant de consultation)
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

  // Lien direct vers la fiche de la consultation, validé contre l'URL de listing
  // pour éviter qu'une hallucination Firecrawl pointe vers un autre portail.
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
        const FEDERATED = ["boamp.fr", "ted.europa.eu", "marches-publics.gouv.fr"];
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
      } catch {
        item_link_rejected_reason = "invalid url";
      }
    }
  }

  // dce_url et source_url : on ne stocke QUE le vrai lien fiche.
  // Si on n'en a pas, on laisse null (le bouton "Voir l'avis original" sera masqué côté front)
  // plutôt que d'envoyer l'utilisateur sur une page de listing générique.
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
