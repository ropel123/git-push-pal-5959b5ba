// scrape-list : scrape une URL de plateforme et renvoie les consultations extraites.
// Utilise Firecrawl en mode JSON structuré (LLM-powered extraction).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/cors.ts";
import { detectPlatformFromUrl } from "../_shared/normalize.ts";

const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/scrape";

const TENDER_SCHEMA = {
  type: "object",
  properties: {
    tenders: {
      type: "array",
      description: "Liste des consultations / appels d'offres trouvés sur la page.",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "Titre / objet de la consultation" },
          reference: { type: "string", description: "Numéro de référence ou identifiant unique" },
          buyer_name: { type: "string", description: "Nom de l'acheteur public" },
          deadline: { type: "string", description: "Date limite (format texte tel qu'affiché)" },
          publication_date: { type: "string", description: "Date de publication (format texte tel qu'affiché)" },
          contract_type: { type: "string", description: "Type : travaux, services, fournitures" },
          procedure_type: { type: "string", description: "Type de procédure (MAPA, AOO, etc.)" },
          estimated_amount: { type: "string", description: "Montant estimé si affiché" },
          description: { type: "string", description: "Description courte" },
          location: { type: "string", description: "Lieu d'exécution / département" },
          dce_url: { type: "string", description: "URL absolue vers la page de la consultation ou son DCE" },
        },
        required: ["title"],
      },
    },
  },
  required: ["tenders"],
};

async function firecrawlScrape(url: string, apiKey: string): Promise<any[]> {
  const resp = await fetch(FIRECRAWL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: [
        {
          type: "json",
          schema: TENDER_SCHEMA,
          prompt:
            `Cette page est un portail de marchés publics français (Atexo, marches-publics.info ColdFusion, ou SDM/Local-trust). L'URL de base de la page est : ${url}.\n\nExtrais TOUTES les consultations / appels d'offres affichés dans le tableau ou la liste principale. Pour chaque ligne, capture : titre/intitulé/objet, référence (numéro de consultation), nom de l'acheteur, date limite de remise des offres (format texte tel qu'affiché, ex: '15/05/2026 12:00'), date de publication, type de procédure (MAPA, AOO, AOR, etc.), type de contrat (travaux/services/fournitures), lieu/département, et l'URL ABSOLUE vers la page détail de la consultation.\n\nRÈGLES STRICTES POUR dce_url :\n- L'URL DOIT avoir EXACTEMENT le même hostname que l'URL de base ci-dessus (ou un sous-domaine direct).\n- Les liens relatifs ('?page=...&id=...', '/consultation/123', './detail?id=...') doivent être résolus contre l'URL de base.\n- N'INVENTE JAMAIS un lien vers un autre portail (boamp.fr, marches-publics.gouv.fr, ted.europa.eu) qui n'apparaît PAS littéralement dans le HTML de la ligne.\n- Si tu n'es pas sûr du lien direct vers la fiche, laisse dce_url vide plutôt que d'inventer.\n\nIgnore les filtres de recherche, la pagination, les en-têtes de colonnes et les bandeaux. Si aucune consultation n'est visible, renvoie un tableau vide.`,
        },
      ],
      onlyMainContent: true,
      waitFor: 1500,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Firecrawl ${resp.status}: ${text.slice(0, 500)}`);
  }
  const payload = await resp.json();
  const data = payload.data ?? payload;
  const items =
    data?.json?.tenders ??
    data?.extract?.tenders ??
    data?.llm_extraction?.tenders ??
    [];
  return Array.isArray(items) ? items : [];
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

    const startedAt = new Date().toISOString();
    const platform = src.platform || detectPlatformFromUrl(src.url);

    let items: any[] = [];
    let errorMsg: string | null = null;
    try {
      items = await firecrawlScrape(src.url, FIRECRAWL_API_KEY);
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e);
    }

    // Annotate with platform + source url
    const enriched = items.map((it) => ({
      ...it,
      _platform: platform,
      _source_url: src.url,
      _sourcing_url_id: src.id,
    }));

    if (dry_run) {
      return json({
        ok: !errorMsg,
        platform,
        items_found: enriched.length,
        items: enriched,
        error: errorMsg,
      });
    }

    // Forward to upsert-tenders
    let inserted = 0,
      updated = 0,
      skipped = 0;
    if (enriched.length > 0) {
      const upsertResp = await fetch(`${SUPABASE_URL}/functions/v1/upsert-tenders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ items: enriched, source: `scrape:${platform}` }),
      });
      const upsertResult = await upsertResp.json().catch(() => ({}));
      inserted = upsertResult.inserted ?? 0;
      updated = upsertResult.updated ?? 0;
      skipped = upsertResult.skipped ?? 0;
    }

    const finishedAt = new Date().toISOString();
    const status = errorMsg ? "failed" : "success";

    await supabase.from("scrape_logs").insert({
      source: `scrape:${platform}`,
      status,
      started_at: startedAt,
      finished_at: finishedAt,
      items_found: enriched.length,
      items_inserted: inserted,
      items_updated: updated,
      items_skipped: skipped,
      errors: errorMsg,
      sourcing_url_id: src.id,
      metadata: { url: src.url, platform },
    });

    await supabase
      .from("sourcing_urls")
      .update({
        last_run_at: finishedAt,
        last_status: status,
        last_items_found: enriched.length,
        last_items_inserted: inserted,
        last_error: errorMsg,
      })
      .eq("id", src.id);

    return json({
      ok: !errorMsg,
      platform,
      items_found: enriched.length,
      inserted,
      updated,
      skipped,
      error: errorMsg,
    });
  } catch (e) {
    console.error("scrape-list error:", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
