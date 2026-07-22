import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const KNOWN_PLATFORMS = [
  "place", "atexo", "mpi", "dematis", "achatpublic",
  "marches-securises", "klekoon", "xmarches", "safetender",
  "aws", "synapse", "centrale-marches", "francemarches", "aji",
  "eu-supply", "domino", "bravo", "custom",
];

const CONCURRENCY = 5;

async function classifyOne(
  host: string,
  sampleUrl: string | null,
  anthropicKey: string,
): Promise<{ platform: string; confidence: number; evidence: string[] } | null> {
  let html = "";
  if (sampleUrl) {
    try {
      const res = await fetch(sampleUrl, {
        headers: { "User-Agent": "Mozilla/5.0 HackAO-classifier" },
        redirect: "follow",
        signal: AbortSignal.timeout(12000),
      });
      html = (await res.text()).slice(0, 6000);
    } catch (_) {
      html = "(fetch failed)";
    }
  }

  const prompt = `Tu es un expert des plateformes françaises de marchés publics.
HOST: ${host}
URL exemple: ${sampleUrl ?? "(aucune)"}
Extrait de la page:
---
${html}
---

Identifie la plateforme parmi cette liste EXACTE :
${KNOWN_PLATFORMS.join(", ")}

Règles importantes :
- "place" = marchés-publics.gouv.fr (PLACE de l'État)
- "atexo" = famille Atexo / PRADO / SDM (maximilien, megalis, ternum, AURA, etc.)
- "mpi" = marches-publics.info
- "dematis" = e-marchespublics.com
- "aws" = aws-france, aws-entreprises, aws-achat
- Si vraiment aucune, utilise "custom"

Réponds UNIQUEMENT en JSON strict :
{"platform":"<one of list>","confidence":0.0-1.0,"reasons":["..."]}`;

  try {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!aiRes.ok) return null;
    const aiJson = await aiRes.json();
    const text = aiJson.content?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as {
      platform: string;
      confidence: number;
      reasons?: string[];
    };
    let platform = parsed.platform?.toLowerCase().trim() ?? "custom";
    if (!KNOWN_PLATFORMS.includes(platform)) platform = "custom";
    return {
      platform,
      confidence: parsed.confidence ?? 0.7,
      evidence: [
        "ai:claude-3.5-sonnet",
        "model:batch-reclassify",
        ...(parsed.reasons ?? []).slice(0, 5).map((r) => `reason:${r}`),
      ],
    };
  } catch (_) {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Load all hosts via the RPC
  const { data: rows, error: rpcErr } = await supabase.rpc(
    "get_dce_sourcing_by_fingerprint",
    { _search: null, _category: null },
  );
  if (rpcErr) {
    return new Response(JSON.stringify({ error: rpcErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const hosts = (rows ?? []) as Array<{ host: string; sample_dce_url: string | null }>;

  // Create job row
  const { data: job, error: jobErr } = await supabase
    .from("reclassify_jobs")
    .insert({ status: "running", total: hosts.length, processed: 0, classified: 0 })
    .select()
    .single();
  if (jobErr || !job) {
    return new Response(JSON.stringify({ error: jobErr?.message ?? "job create failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const work = async () => {
    let processed = 0;
    let classified = 0;
    const errors: Array<{ host: string; error: string }> = [];

    for (let i = 0; i < hosts.length; i += CONCURRENCY) {
      const slice = hosts.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        slice.map(async (h) => {
          const r = await classifyOne(h.host, h.sample_dce_url, anthropicKey);
          if (!r) {
            errors.push({ host: h.host, error: "classification failed" });
            return null;
          }
          const { error: upErr } = await supabase
            .from("platform_fingerprints")
            .upsert(
              {
                host: h.host,
                platform: r.platform,
                confidence: r.confidence,
                evidence: r.evidence,
                detected_at: new Date().toISOString(),
              },
              { onConflict: "host" },
            );
          if (upErr) {
            errors.push({ host: h.host, error: upErr.message });
            return null;
          }
          return r;
        }),
      );
      processed += slice.length;
      classified += results.filter(Boolean).length;

      await supabase
        .from("reclassify_jobs")
        .update({
          processed,
          classified,
          errors: errors.slice(-50),
        })
        .eq("id", job.id);
    }

    await supabase
      .from("reclassify_jobs")
      .update({
        status: "done",
        processed,
        classified,
        errors,
        finished_at: new Date().toISOString(),
      })
      .eq("id", job.id);
  };

  // @ts-ignore - EdgeRuntime is available in Deno Deploy/Supabase
  EdgeRuntime.waitUntil(work());

  return new Response(JSON.stringify({ job_id: job.id, total: hosts.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
