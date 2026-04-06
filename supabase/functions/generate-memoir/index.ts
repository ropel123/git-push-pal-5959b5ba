import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es un consultant expert en marchés publics français. Ton rôle est d'interviewer un chef d'entreprise pour construire un mémoire technique complet et exhaustif de son entreprise.

OBJECTIF : Collecter TOUTES les informations nécessaires pour remplir un mémoire technique professionnel qui sera utilisé pour répondre aux appels d'offres publics.

MÉTHODE :
- Pose UNE question à la fois, de manière conversationnelle et professionnelle
- Commence par te présenter brièvement et expliquer l'objectif
- Suis un ordre logique : présentation générale → certifications → compétences → équipe → équipements → projets réalisés → qualité/RSE
- Rebondis sur les réponses pour approfondir
- N'hésite pas à demander des précisions (montants, dates, noms de clients)
- Encourage l'utilisateur à être exhaustif

THÈMES À COUVRIR (dans l'ordre) :
1. Activité principale et secteurs d'intervention
2. Certifications et qualifications (ISO, Qualibat, RGE, MASE, etc.)
3. Compétences clés et savoir-faire distinctifs
4. Équipe : effectifs, profils clés, organigramme, formations
5. Moyens matériels et techniques : équipements, logiciels, véhicules
6. Références et projets réalisés : client, montant, description, date
7. Démarche qualité, sécurité et environnement
8. Engagements RSE et développement durable
9. Chiffre d'affaires et capacité financière
10. Couverture géographique et logistique

Quand tu estimes avoir collecté suffisamment d'informations (après au moins 8-10 échanges), propose un RÉSUMÉ structuré et demande confirmation. Si l'utilisateur confirme, utilise l'outil save_memoir pour sauvegarder les données structurées.

IMPORTANT : Sois chaleureux, professionnel et encourageant. L'utilisateur n'est pas forcément à l'aise avec l'exercice.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch current profile to give context
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    let profileContext = "";
    if (profile) {
      const parts = [];
      if (profile.company_name) parts.push(`Nom: ${profile.company_name}`);
      if (profile.company_description) parts.push(`Description: ${profile.company_description}`);
      if (profile.sectors?.length) parts.push(`Secteurs: ${(profile.sectors as string[]).join(", ")}`);
      if (profile.company_size) parts.push(`Taille: ${profile.company_size}`);
      if (profile.company_certifications?.length) parts.push(`Certifications: ${(profile.company_certifications as string[]).join(", ")}`);
      if (profile.company_skills) parts.push(`Compétences: ${profile.company_skills}`);
      if (profile.company_team) parts.push(`Équipe: ${profile.company_team}`);
      if (profile.company_equipment) parts.push(`Équipements: ${profile.company_equipment}`);
      if (profile.company_past_work) parts.push(`Travaux: ${profile.company_past_work}`);
      if (profile.company_references && Array.isArray(profile.company_references) && (profile.company_references as any[]).length > 0) {
        parts.push(`Références: ${JSON.stringify(profile.company_references)}`);
      }
      if (parts.length > 0) {
        profileContext = `\n\nINFORMATIONS DÉJÀ CONNUES SUR L'ENTREPRISE :\n${parts.join("\n")}\n\nTiens compte de ces informations et ne redemande pas ce qui est déjà renseigné. Approfondis plutôt ce qui manque.`;
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY non configurée" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + profileContext },
          ...messages,
        ],
        stream: true,
        tools: [
          {
            type: "function",
            function: {
              name: "save_memoir",
              description: "Sauvegarde le mémoire technique structuré de l'entreprise une fois toutes les informations collectées et confirmées par l'utilisateur",
              parameters: {
                type: "object",
                properties: {
                  company_certifications: {
                    type: "array",
                    items: { type: "string" },
                    description: "Liste des certifications (ISO 9001, Qualibat, RGE, MASE, etc.)",
                  },
                  company_skills: {
                    type: "string",
                    description: "Compétences clés et savoir-faire en markdown",
                  },
                  company_team: {
                    type: "string",
                    description: "Description des moyens humains en markdown",
                  },
                  company_equipment: {
                    type: "string",
                    description: "Moyens matériels et techniques en markdown",
                  },
                  company_past_work: {
                    type: "string",
                    description: "Description détaillée des travaux et projets réalisés en markdown",
                  },
                  company_references: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        client: { type: "string" },
                        amount: { type: "string" },
                        date: { type: "string" },
                        description: { type: "string" },
                      },
                      required: ["title", "client"],
                    },
                    description: "Références de projets réalisés",
                  },
                  company_description: {
                    type: "string",
                    description: "Description enrichie de l'entreprise",
                  },
                },
                required: ["company_skills", "company_team"],
                additionalProperties: false,
              },
            },
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", status, errText);
      return new Response(JSON.stringify({ error: "Erreur IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream the response back
    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-memoir error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
