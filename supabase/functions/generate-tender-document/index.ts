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

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Non authentifié");

    const { tender_id, document_type, template, include_references } = await req.json();
    if (!tender_id) throw new Error("tender_id requis");

    const [tenderRes, profileRes, analysesRes] = await Promise.all([
      supabase.from("tenders").select("*").eq("id", tender_id).single(),
      supabase.from("profiles").select("*").eq("user_id", user.id).single(),
      supabase.from("tender_analyses").select("*").eq("tender_id", tender_id).eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);

    const tender = tenderRes.data;
    const profile = profileRes.data;
    const analyses = analysesRes.data || [];

    if (!tender) throw new Error("Tender introuvable");

    const analysisTexts = analyses.map((a: any) => `[${a.analysis_type}]\n${a.result || ""}`).join("\n\n---\n\n");
    const refs = include_references && profile?.company_references
      ? JSON.stringify(profile.company_references)
      : "Aucune référence fournie";

    const templateInstructions = template === "memoire_technique"
      ? `Génère un mémoire technique professionnel avec des sections VARIÉES et TYPÉES. Tu DOIS utiliser différents types de sections pour rendre le document visuellement attractif :

Sections à générer (dans cet ordre) :
1. type "cover" : Juste le sous-titre accrocheur du document (2 phrases max)
2. type "summary" : Liste les titres de toutes les sections du document  
3. type "stats" : 3-4 chiffres clés de l'entreprise (années d'expérience, projets réalisés, effectif, certifications...)
4. type "content" : Compréhension du besoin (analyse détaillée)
5. type "two_columns" : Méthodologie proposée (colonne gauche: approche, colonne droite: outils/moyens)
6. type "content" : Moyens humains et matériels
7. type "content" : Planning prévisionnel  
8. type "two_columns" : Démarche qualité et environnement (colonne gauche: qualité, colonne droite: environnement)
9. type "content" : Valeur ajoutée de notre offre
10. type "references" : Références pertinentes
11. type "closing" : Phrase de conclusion convaincante`
      : `Génère une présentation d'entreprise avec des sections VARIÉES et TYPÉES :

1. type "cover" : Sous-titre accrocheur
2. type "summary" : Sommaire des sections
3. type "stats" : 3-4 chiffres clés impressionnants
4. type "content" : Présentation de l'entreprise
5. type "two_columns" : Notre expertise (colonne gauche: domaines, colonne droite: réalisations)
6. type "content" : Méthodologie
7. type "content" : Équipe dédiée
8. type "two_columns" : Pourquoi nous choisir (colonne gauche: avantages, colonne droite: engagements)
9. type "references" : Références
10. type "closing" : Conclusion`;

    const systemPrompt = `Tu es un expert en réponse aux marchés publics français. Tu rédiges des documents professionnels et convaincants.
Tu DOIS retourner des sections avec des types variés pour créer un document visuellement riche.
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

Génère le document avec les sections typées demandées. Le contenu doit être substantiel (au moins 3-4 paragraphes par section content, 3-4 items par section stats).`;

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
              description: "Generate typed document sections for a professional tender response",
              parameters: {
                type: "object",
                properties: {
                  sections: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: {
                          type: "string",
                          enum: ["cover", "summary", "content", "stats", "two_columns", "references", "closing"],
                          description: "The visual layout type for this section",
                        },
                        title: { type: "string" },
                        content: { type: "string", description: "Main text content" },
                        subtitle: { type: "string", description: "For cover type: subtitle text" },
                        summary_items: {
                          type: "array",
                          items: { type: "string" },
                          description: "For summary type: list of section titles",
                        },
                        stats: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              value: { type: "string", description: "The number/stat (e.g. '15+', '200', '100%')" },
                              label: { type: "string", description: "Short label (e.g. 'années d expérience')" },
                            },
                            required: ["value", "label"],
                            additionalProperties: false,
                          },
                          description: "For stats type: array of key figures",
                        },
                        left_column: { type: "string", description: "For two_columns type: left column content" },
                        right_column: { type: "string", description: "For two_columns type: right column content" },
                        left_title: { type: "string", description: "For two_columns type: left column title" },
                        right_title: { type: "string", description: "For two_columns type: right column title" },
                      },
                      required: ["type", "title"],
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

    if (sections.length === 0) {
      const content = aiData.choices?.[0]?.message?.content || "";
      try {
        const parsed = JSON.parse(content);
        sections = parsed.sections || [];
      } catch {
        sections = [{ type: "content", title: "Contenu généré", content }];
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
