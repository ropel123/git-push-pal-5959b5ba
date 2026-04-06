import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Non authentifié");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Non authentifié");

    const { tender_id, document_type, template, include_references } = await req.json();
    if (!tender_id) throw new Error("tender_id requis");

    // Fetch data
    const [tenderRes, profileRes, analysesRes] = await Promise.all([
      supabase.from("tenders").select("*").eq("id", tender_id).single(),
      supabase.from("profiles").select("*").eq("user_id", user.id).single(),
      supabase.from("tender_analyses").select("*").eq("tender_id", tender_id).eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);

    const tender = tenderRes.data;
    const profile = profileRes.data;
    const analyses = analysesRes.data || [];

    if (!tender) throw new Error("Tender introuvable");

    // Build prompt
    const analysisTexts = analyses.map((a: any) => `[${a.analysis_type}]\n${a.result || ""}`).join("\n\n---\n\n");
    const refs = include_references && profile?.company_references
      ? JSON.stringify(profile.company_references)
      : "Aucune référence fournie";

    const templateInstructions = template === "memoire_technique"
      ? `Génère un mémoire technique structuré avec les sections suivantes :
1. Compréhension du besoin
2. Méthodologie proposée
3. Moyens humains et matériels
4. Planning prévisionnel
5. Démarche qualité et environnement
6. Valeur ajoutée de notre offre`
      : `Génère une présentation d'entreprise pour répondre à cet appel d'offres avec :
1. Présentation de l'entreprise
2. Notre expertise dans ce domaine
3. Méthodologie
4. Équipe dédiée
5. Pourquoi nous choisir`;

    const systemPrompt = `Tu es un expert en réponse aux marchés publics français. Tu rédiges des documents professionnels et convaincants.
Réponds UNIQUEMENT avec un JSON valide contenant un tableau "sections" avec des objets {title, content}.
Le contenu doit être détaillé, professionnel et adapté au marché.`;

    const userPrompt = `${templateInstructions}

INFORMATIONS DU MARCHÉ :
- Titre : ${tender.title}
- Objet : ${tender.object || "Non précisé"}
- Acheteur : ${tender.buyer_name || "Non précisé"}
- Description : ${tender.description || "Non disponible"}
- Critères d'attribution : ${tender.award_criteria || "Non précisés"}
- Conditions : ${tender.participation_conditions || "Non précisées"}

ENTREPRISE :
- Nom : ${profile?.company_name || "Non renseigné"}
- Description : ${profile?.company_description || "Non renseignée"}
- Secteurs : ${(profile?.sectors as string[])?.join(", ") || "Non renseignés"}
- Certifications : ${(profile as any)?.company_certifications?.length ? (profile as any).company_certifications.join(", ") : "Non renseignées"}
- Compétences : ${(profile as any)?.company_skills || "Non renseignées"}
- Moyens humains : ${(profile as any)?.company_team || "Non renseignés"}
- Moyens matériels : ${(profile as any)?.company_equipment || "Non renseignés"}
- Travaux réalisés : ${(profile as any)?.company_past_work || "Non renseignés"}

ANALYSES IA EXISTANTES :
${analysisTexts || "Aucune analyse disponible"}

RÉFÉRENCES :
${refs}

Génère le JSON avec les sections demandées. Le contenu doit être substantiel (au moins 3-4 paragraphes par section).`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY non configurée");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_document_sections",
              description: "Generate structured document sections for a tender response",
              parameters: {
                type: "object",
                properties: {
                  sections: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        content: { type: "string" },
                      },
                      required: ["title", "content"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["sections"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_document_sections" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("Erreur IA");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let sections = [];

    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        sections = parsed.sections || [];
      } catch {
        console.error("Failed to parse tool call arguments");
      }
    }

    // Fallback: try parsing content as JSON
    if (sections.length === 0) {
      const content = aiData.choices?.[0]?.message?.content || "";
      try {
        const parsed = JSON.parse(content);
        sections = parsed.sections || [];
      } catch {
        sections = [{ title: "Contenu généré", content }];
      }
    }

    return new Response(JSON.stringify({ sections }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-tender-document error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
