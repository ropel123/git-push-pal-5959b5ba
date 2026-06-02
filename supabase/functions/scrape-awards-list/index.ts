// scrape-awards-list — Agent dédié aux pages "Avis d'attribution".
// Reprend la même mécanique que scrape-list mais avec un schéma + prompt
// spécifiques aux marchés attribués, et insère dans public.award_notices.
//
// Stratégie : extraction structurée Firecrawl (LLM) sur la page listée.
// Pour les versions ultérieures, possibilité de paginer via actions.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/cors.ts";
import { detectPlatformFromUrl } from "../_shared/normalize.ts";

const FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v2/scrape";

const AWARD_SCHEMA = {
  type: "object",
  properties: {
    awards: {
      type: "array",
      description: "Liste des avis d'attribution affichés sur la page (marchés attribués / résultats de consultation).",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "Objet/titre du marché attribué" },
          reference: { type: "string", description: "Référence du marché ou de la consultation" },
          buyer_name: { type: "string", description: "Nom de l'acheteur public" },
          buyer_siret: { type: "string", description: "SIRET acheteur si visible" },
          winner_name: { type: "string", description: "Nom de l'attributaire / titulaire" },
          winner_siren: { type: "string", description: "SIREN/SIRET attributaire si visible" },
          awarded_amount: { type: "string", description: "Montant attribué, brut tel qu'affiché" },
          award_date: { type: "string", description: "Date d'attribution / notification" },
          contract_duration: { type: "string" },
          num_candidates: { type: "string" },
          source_url: { type: "string", description: "URL ABSOLUE vers la fiche détail de l'avis" },
        },
        required: ["title"],
      },
    },
  },
  required: ["awards"],
};

const AWARD_PROMPT = (baseUrl: string) =>
  `Cette page est un portail de marchés publics français qui liste des AVIS D'ATTRIBUTION (marchés déjà attribués). URL de base : ${baseUrl}.

Extrais TOUS les marchés attribués affichés. Pour chacun :
- title : objet/intitulé du marché
- reference : référence brute (sans préfixes 'réf.','n°')
- buyer_name : acheteur
- winner_name : titulaire / attributaire
- awarded_amount : montant attribué tel qu'affiché (garder la devise)
- award_date : date d'attribution ou de notification
- source_url : URL ABSOLUE vers la fiche détail (même hostname que l'URL de base)

RÈGLES :
- N'invente jamais un attributaire ou un montant.
- Si une info n'est pas affichée, omets le champ.
- Ignore filtres, pagination, en-têtes. Si rien : tableau vide.`;

async function firecrawlExtractAwards(url: string, apiKey: string): Promise<Array<Record<string, unknown>>> {
  const resp = await fetch(FIRECRAWL_SCRAPE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      formats: [{ type: "json", schema: AWARD_SCHEMA, prompt: AWARD_PROMPT(url) }, "links"],
      onlyMainContent: true,
      waitFor: 1500,
    }),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`Firecrawl ${resp.status}: ${t.slice(0, 300)}`);
  }
  const payload = await resp.json();
  const data = payload.data ?? payload;
  const awards = data?.json?.awards ?? data?.extract?.awards ?? [];
  return Array.isArray(awards) ? awards : [];
}

function parseAmount(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw).replace(/\s|\u00A0/g, "").replace(/[€$£]/g, "").replace(/,/g, ".");
  const m = s.match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function parseDate(raw: unknown): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const m1 = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
  const m2 = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) return json({ error: "FIRECRAWL_API_KEY missing" }, 500);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const { sourcing_url_id, dry_run = false } = body;
    if (!sourcing_url_id) return json({ error: "sourcing_url_id required" }, 400);

    const { data: src, error: srcErr } = await supabase
      .from("sourcing_urls")
      .select("*")
      .eq("id", sourcing_url_id)
      .maybeSingle();
    if (srcErr || !src) return json({ error: "sourcing_url not found" }, 404);
    if ((src as { kind?: string }).kind !== "award") {
      return json({ error: "sourcing_url kind must be 'award'" }, 400);
    }

    const startedAt = new Date().toISOString();
    const platform = detectPlatformFromUrl(src.url);

    let awards: Array<Record<string, unknown>> = [];
    let errorMessage: string | null = null;
    try {
      awards = await firecrawlExtractAwards(src.url, FIRECRAWL_API_KEY);
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : String(e);
    }

    if (dry_run) {
      return json({
        ok: !errorMessage,
        platform,
        items_found: awards.length,
        items: awards.slice(0, 50),
        error: errorMessage,
      });
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    if (!errorMessage && awards.length > 0) {
      for (const a of awards) {
        const source_url = (a.source_url as string | undefined)?.trim() || null;
        const reference = (a.reference as string | undefined)?.trim() || null;
        const buyer_siret = (a.buyer_siret as string | undefined)?.trim() || null;
        const title = (a.title as string | undefined)?.trim() || "(sans titre)";

        // Try matching to an existing tender
        let tender_id: string | null = null;
        if (reference) {
          const { data: t } = await supabase
            .from("tenders")
            .select("id")
            .eq("reference", reference)
            .maybeSingle();
          if (t?.id) tender_id = t.id;
        }

        // Dedup by source_url when provided
        if (source_url) {
          const { data: existing } = await supabase
            .from("award_notices")
            .select("id")
            .eq("source_url", source_url)
            .maybeSingle();
          if (existing?.id) {
            await supabase
              .from("award_notices")
              .update({
                title,
                reference,
                buyer_name: a.buyer_name ?? null,
                buyer_siret,
                winner_name: a.winner_name ?? null,
                winner_siren: a.winner_siren ?? null,
                awarded_amount: parseAmount(a.awarded_amount),
                award_date: parseDate(a.award_date),
                contract_duration: a.contract_duration ?? null,
                num_candidates: a.num_candidates ? Number(a.num_candidates) || null : null,
                tender_id,
                raw: a,
              })
              .eq("id", existing.id);
            updated++;
            continue;
          }
        }

        const { error: insErr } = await supabase.from("award_notices").insert({
          tender_id,
          title,
          reference,
          buyer_name: a.buyer_name ?? null,
          buyer_siret,
          winner_name: a.winner_name ?? null,
          winner_siren: a.winner_siren ?? null,
          awarded_amount: parseAmount(a.awarded_amount),
          award_date: parseDate(a.award_date),
          contract_duration: a.contract_duration ?? null,
          num_candidates: a.num_candidates ? Number(a.num_candidates) || null : null,
          source: `scrape:${platform}`,
          source_url,
          sourcing_url_id: src.id,
          raw: a,
        });
        if (insErr) skipped++;
        else inserted++;
      }
    }

    const finishedAt = new Date().toISOString();
    const status = errorMessage ? "failed" : "success";

    await supabase.from("scrape_logs").insert({
      source: `scrape-awards:${platform}`,
      status,
      started_at: startedAt,
      finished_at: finishedAt,
      items_found: awards.length,
      items_inserted: inserted,
      items_updated: updated,
      items_skipped: skipped,
      errors: errorMessage,
      sourcing_url_id: src.id,
      metadata: { url: src.url, platform, kind: "award" },
    });

    await supabase
      .from("sourcing_urls")
      .update({
        last_run_at: finishedAt,
        last_status: status,
        last_items_found: awards.length,
        last_items_inserted: inserted,
        last_error: errorMessage,
      })
      .eq("id", src.id);

    return json({
      ok: !errorMessage,
      platform,
      items_found: awards.length,
      inserted,
      updated,
      skipped,
      error: errorMessage,
    });
  } catch (e) {
    console.error("scrape-awards-list error:", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
