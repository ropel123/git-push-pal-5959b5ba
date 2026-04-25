// scout-playbook : Agent Scout (Claude) qui analyse une page de portail
// et génère un playbook de scraping (stratégie + sélecteurs + pagination).
// Tourne UNE seule fois par URL (à l'ajout) ou via bouton "Analyser avec IA".

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/cors.ts";
import { preprocess } from "../_shared/domPreprocessor.ts";
import { detectPlatformFromUrl } from "../_shared/normalize.ts";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const SCOUT_MODEL = "claude-sonnet-4-5";

const SCOUT_SYSTEM = `Tu es un expert en scraping de portails de marchés publics français.
Ton rôle : analyser une page de listing et produire un PLAYBOOK structuré décrivant
comment l'extraire et la paginer.

Tu reçois :
- url : URL de base du portail
- clean_dom : HTML body nettoyé (scripts/styles/nav supprimés, ~30KB max)
- links : tous les href absolutisés trouvés sur la page
- text_sample : échantillon de texte visible
- structural_hints : flags has_table, has_pagination_widget, form_count

Tu DOIS répondre UNIQUEMENT en appelant l'outil emit_playbook avec ces champs.

Règles :
- list_strategy = "template" si pagination par paramètre URL clair (?page=N, &PageNumber=N)
- list_strategy = "hybrid" si la liste pointe vers des pages détail riches (recommandé pour atexo, mpi, achatpublic)
- list_strategy = "map" si pagination JS/POST imbattable, OU portail à URLs plates (omnikles, klekoon)
- list_strategy = "manual" si tu n'identifies AUCUN pattern fiable

- pagination_hint : "numbered" (1,2,3...), "next_button" (Suivant>), "infinite_scroll", "none", "unknown"

- confidence : 0.0-1.0
  * >=0.9 : tu es certain (pattern URL visible + selectors trouvés)
  * 0.7-0.9 : raisonnable (1 indice fort)
  * <0.7 : doute → le moteur basculera en fallback déclaratif
  * <0.5 : nécessite validation manuelle

- selectors.list_rows : sélecteur CSS des lignes de la liste (ex: "table.results tbody tr")
- selectors.detail_link : sélecteur du lien vers le détail (ex: "a[href*='refConsult']")
- selectors.next_page_indicator : optionnel

- evidence : 1 phrase (max 200 car) citant l'élément observé qui justifie la décision

INTERDICTIONS :
- N'invente JAMAIS de sélecteur que tu ne vois pas dans le clean_dom
- Si tu hésites entre 2 stratégies, choisis "hybrid" et baisse confidence à 0.6
- Si la page semble vide ou non-marchés-publics, list_strategy="manual" + confidence=0`;

const PLAYBOOK_TOOL = {
  name: "emit_playbook",
  description: "Émet le playbook de scraping pour cette URL.",
  input_schema: {
    type: "object",
    properties: {
      list_strategy: { type: "string", enum: ["template", "hybrid", "map", "manual"] },
      pagination_hint: {
        type: "string",
        enum: ["numbered", "next_button", "infinite_scroll", "none", "unknown"],
      },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      pagination: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["url_param", "url_path", "form_post", "none"] },
          param: { type: "string" },
          first_page: { type: "integer" },
          url_template: { type: "string" },
        },
      },
      selectors: {
        type: "object",
        properties: {
          list_rows: { type: "string" },
          detail_link: { type: "string" },
          next_page_indicator: { type: "string" },
        },
      },
      evidence: { type: "string", maxLength: 250 },
    },
    required: ["list_strategy", "pagination_hint", "confidence", "evidence"],
  },
};

async function fetchPageHtml(url: string): Promise<string> {
  const resp = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; HackifyScout/1.0; +https://hackify.fr)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });
  if (!resp.ok) throw new Error(`fetch HTML ${resp.status}`);
  return await resp.text();
}

async function callClaude(payload: ReturnType<typeof preprocess>, apiKey: string) {
  const userMsg = JSON.stringify(payload);
  const resp = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: SCOUT_MODEL,
      max_tokens: 1024,
      system: SCOUT_SYSTEM,
      tools: [PLAYBOOK_TOOL],
      tool_choice: { type: "tool", name: "emit_playbook" },
      messages: [{ role: "user", content: userMsg }],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Anthropic ${resp.status}: ${text.slice(0, 300)}`);
  }
  const data = await resp.json();
  const toolUse = (data.content ?? []).find((c: { type: string }) => c.type === "tool_use");
  if (!toolUse) throw new Error("No tool_use in Claude response");
  return {
    playbook: toolUse.input as Record<string, unknown>,
    tokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY missing" }, 500);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const { sourcing_url_id, reason = "manual" } = body;
    if (!sourcing_url_id) return json({ error: "sourcing_url_id required" }, 400);

    const { data: src, error: srcErr } = await supabase
      .from("sourcing_urls")
      .select("id, url, platform")
      .eq("id", sourcing_url_id)
      .maybeSingle();
    if (srcErr || !src) return json({ error: "sourcing_url not found" }, 404);

    // 1. Fetch HTML
    let html: string;
    try {
      html = await fetchPageHtml(src.url);
    } catch (e) {
      return json({ error: `fetch failed: ${e instanceof Error ? e.message : e}` }, 502);
    }

    // 2. Preprocess
    const pre = preprocess(html, src.url);

    // 3. Call Claude
    let result;
    try {
      result = await callClaude(pre, ANTHROPIC_API_KEY);
    } catch (e) {
      return json({ error: `claude failed: ${e instanceof Error ? e.message : e}` }, 502);
    }

    const pb = result.playbook;
    const platform = detectPlatformFromUrl(src.url);

    // 4. Désactive l'ancien playbook actif et calcule le n° de version
    const { data: existing } = await supabase
      .from("agent_playbooks")
      .select("id, version")
      .eq("sourcing_url_id", sourcing_url_id)
      .order("version", { ascending: false })
      .limit(1);
    const nextVersion = existing && existing.length > 0 ? (existing[0].version ?? 0) + 1 : 1;

    if (existing && existing.length > 0) {
      await supabase
        .from("agent_playbooks")
        .update({ is_active: false })
        .eq("sourcing_url_id", sourcing_url_id);
    }

    // 5. Insert nouveau playbook
    const { data: inserted, error: insErr } = await supabase
      .from("agent_playbooks")
      .insert({
        sourcing_url_id,
        platform,
        display_name: `${platform} v${nextVersion} (scout:${reason})`,
        url_pattern: src.url,
        list_strategy: pb.list_strategy,
        pagination_hint: pb.pagination_hint,
        confidence: pb.confidence,
        config: {
          pagination: pb.pagination ?? {},
          selectors: pb.selectors ?? {},
        },
        steps: [],
        evidence: pb.evidence,
        scout_model: SCOUT_MODEL,
        scout_tokens_used: result.tokens,
        version: nextVersion,
        is_active: true,
        last_validated_at: new Date().toISOString(),
        fail_count: 0,
      } as Record<string, unknown>)
      .select()
      .single();

    if (insErr) return json({ error: `insert failed: ${insErr.message}` }, 500);

    return json({
      ok: true,
      playbook: inserted,
      raw_html_kb: Math.round(pre.structural_hints.raw_size_bytes / 1024),
      clean_dom_kb: Math.round(pre.clean_dom.length / 1024),
      tokens: result.tokens,
    });
  } catch (e) {
    console.error("scout-playbook error:", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
