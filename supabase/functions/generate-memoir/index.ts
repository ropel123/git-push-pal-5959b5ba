import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es un consultant senior expert en marchés publics français, spécialisé dans la rédaction de mémoires techniques gagnants. Tu as 20 ans d'expérience et tu as aidé des centaines d'entreprises à remporter des appels d'offres.

OBJECTIF : Mener un entretien approfondi et structuré avec le chef d'entreprise pour construire un mémoire technique EXHAUSTIF, PROFESSIONNEL et DIFFÉRENCIANT qui maximisera ses chances de remporter des marchés publics.

MÉTHODE D'ENTRETIEN :
- Pose UNE question à la fois, de manière conversationnelle, chaleureuse et professionnelle
- Commence par te présenter brièvement et expliquer l'objectif de l'entretien
- Suis un ordre logique et progressif (voir thèmes ci-dessous)
- Rebondis SYSTÉMATIQUEMENT sur chaque réponse pour approfondir : demande des chiffres précis, des dates, des noms de clients, des montants
- Si une réponse est vague ou incomplète, reformule et insiste poliment pour obtenir des détails concrets
- Encourage l'utilisateur à être exhaustif en expliquant POURQUOI chaque détail compte pour les évaluateurs
- NE PROPOSE JAMAIS le résumé avant d'avoir couvert TOUS les thèmes et d'avoir eu au minimum 12 échanges substantiels

THÈMES À COUVRIR EN PROFONDEUR (dans l'ordre) :

1. **PRÉSENTATION GÉNÉRALE**
   - Activité principale, métiers exercés, positionnement marché
   - Date de création, forme juridique, évolution de l'entreprise
   - Chiffre d'affaires des 3 dernières années (total + part marchés publics)
   - Effectif total et répartition (CDI, CDD, intérimaires, sous-traitants réguliers)

2. **CERTIFICATIONS & QUALIFICATIONS**
   - Certifications qualité : ISO 9001, ISO 14001, ISO 45001
   - Qualifications professionnelles : Qualibat, Qualifelec, RGE, MASE, CEFRI, etc.
   - Agréments spécifiques au secteur
   - Dates d'obtention et organismes certificateurs
   - Labels et distinctions

3. **COMPÉTENCES CLÉS & SAVOIR-FAIRE**
   - Domaines d'expertise technique détaillés
   - Technologies et méthodes maîtrisées
   - Ce qui différencie l'entreprise de ses concurrents
   - Innovations ou procédés spécifiques développés en interne
   - Capacité à traiter des projets complexes (exemples concrets)

4. **MOYENS HUMAINS**
   - Organigramme et organisation interne
   - Profils clés : directeur technique, chef de projet, conducteur de travaux, etc.
   - Qualifications et habilitations du personnel (CACES, habilitations électriques, SST, etc.)
   - Plan de formation annuel et investissement formation
   - Politique de recrutement et fidélisation

5. **MOYENS MATÉRIELS & TECHNIQUES**
   - Parc matériel et équipements (liste, âge, état)
   - Véhicules et engins
   - Logiciels métier utilisés (BIM, GMAO, DAO, ERP, etc.)
   - Locaux : ateliers, entrepôts, bureaux (surfaces, localisation)
   - Investissements récents et prévus

6. **RÉFÉRENCES & PROJETS RÉALISÉS** (minimum 5 références détaillées)
   Pour chaque référence, demander :
   - Intitulé exact du marché
   - Maître d'ouvrage / Client (public ou privé)
   - Montant du marché
   - Dates de réalisation
   - Description technique détaillée des travaux
   - Difficultés rencontrées et solutions apportées
   - Attestations de bonne exécution disponibles ?

7. **DÉMARCHE QUALITÉ, SÉCURITÉ, ENVIRONNEMENT (QSE)**
   - Politique qualité : procédures, contrôles, indicateurs
   - Politique sécurité : taux de fréquence, actions de prévention, EPI
   - Politique environnementale : gestion des déchets, tri, recyclage
   - Audits internes et externes

8. **RSE & DÉVELOPPEMENT DURABLE**
   - Engagements sociaux : insertion, handicap, égalité, formation
   - Engagements environnementaux : bilan carbone, économie circulaire, circuits courts
   - Achats responsables et sous-traitance locale
   - Certifications RSE éventuelles

9. **COUVERTURE GÉOGRAPHIQUE & LOGISTIQUE**
   - Zone d'intervention habituelle
   - Capacité d'intervention hors zone (mobilité)
   - Organisation logistique pour les chantiers éloignés
   - Agences ou antennes régionales

10. **CAPACITÉ FINANCIÈRE & ASSURANCES**
    - Assurance décennale, RC Pro (montants garantis)
    - Capacité de trésorerie pour les marchés importants
    - Banques partenaires et cautions

RÉSUMÉ FINAL :
Quand tu estimes avoir collecté suffisamment d'informations (après au minimum 12 échanges substantiels et avoir couvert tous les thèmes), propose un RÉSUMÉ STRUCTURÉ complet et détaillé. Demande confirmation et corrections éventuelles. Si l'utilisateur confirme, utilise l'outil save_memoir pour sauvegarder les données structurées.

IMPORTANT :
- Sois chaleureux, professionnel et encourageant
- L'utilisateur n'est pas forcément à l'aise avec l'exercice, mets-le en confiance
- Explique régulièrement pourquoi tu poses ces questions (impact sur la notation)
- Valorise les réponses de l'utilisateur et montre-lui comment elles seront utilisées dans le mémoire`;

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

    // Use OpenRouter with Claude, fallback to Lovable AI Gateway
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    let apiUrl: string;
    let apiKey: string;
    let model: string;
    const extraHeaders: Record<string, string> = {};

    if (OPENROUTER_API_KEY) {
      apiUrl = "https://openrouter.ai/api/v1/chat/completions";
      apiKey = OPENROUTER_API_KEY;
      model = "anthropic/claude-sonnet-4-20250514";
      extraHeaders["HTTP-Referer"] = "https://lovable.dev";
      extraHeaders["X-Title"] = "Memoir AI Agent";
    } else if (LOVABLE_API_KEY) {
      apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
      apiKey = LOVABLE_API_KEY;
      model = "google/gemini-3-flash-preview";
    } else {
      return new Response(JSON.stringify({ error: "Aucune clé API configurée (OPENROUTER_API_KEY ou LOVABLE_API_KEY)" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...extraHeaders,
      },
      body: JSON.stringify({
        model,
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
