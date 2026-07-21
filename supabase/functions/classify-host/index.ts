import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const KNOWN_PLATFORMS = [
  "place", "atexo", "mpi", "dematis", "achatpublic",
  "marches-securises", "klekoon", "xmarches", "safetender",
  "aws", "synapse", "centrale-marches", "francemarches", "aji",
  "eu-supply", "domino", "bravo", "custom",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { host, sample_url } = await req.json();
    if (!host || !sample_url) {
      return new Response(JSON.stringify({ error: "host and sample_url required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch a snippet of the page
    let html = "";
    try {
      const res = await fetch(sample_url, {
        headers: { "User-Agent": "Mozilla/5.0 Gaston-classifier" },
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });
      html = (await res.text()).slice(0, 8000);
    } catch (_) {
      html = "(fetch failed)";
    }

    const prompt = `Tu es un expert des plateformes françaises de marchés publics.
Voici le HOST: ${host}
Voici l'URL exemple: ${sample_url}
Voici un extrait HTML/headers de la page:
---
${html}
---

Identifie la plateforme parmi cette liste exacte :
${KNOWN_PLATFORMS.join(", ")}

Si aucune ne correspond, utilise "custom".
Réponds UNIQUEMENT en JSON strict:
{"platform":"<one of list>","confidence":0.0-1.0,"reasons":["..."]}`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      return new Response(JSON.stringify({ error: "AI error", detail: t }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const text = aiJson.content?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return new Response(JSON.stringify({ error: "AI returned non-JSON", raw: text }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = JSON.parse(match[0]) as {
      platform: string;
      confidence: number;
      reasons?: string[];
    };

    let platform = parsed.platform?.toLowerCase().trim() ?? "custom";
    if (!KNOWN_PLATFORMS.includes(platform)) platform = "custom";

    const evidence = [
      `ai:claude-3-5-haiku`,
      ...(parsed.reasons ?? []).slice(0, 5).map((r) => `reason:${r}`),
    ];

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: upErr } = await supabase
      .from("platform_fingerprints")
      .upsert(
        {
          host,
          platform,
          confidence: parsed.confidence ?? 0.7,
          evidence,
          detected_at: new Date().toISOString(),
        },
        { onConflict: "host" }
      );

    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ platform, confidence: parsed.confidence ?? 0.7, evidence }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
