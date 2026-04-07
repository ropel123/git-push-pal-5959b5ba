import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const systemPrompt = `Tu es un expert en chiffrage et stratégie commerciale pour les marchés publics français. Tu aides les entreprises à construire leur réponse commerciale (prix, marges, décomposition par lots/postes).

Tu as accès aux informations COMPLÈTES suivantes :
- Les données détaillées de l'appel d'offres (titre, objet, critères, lots, montant estimé, conditions, DCE)
- Les analyses IA déjà réalisées sur cet AO (analyse rapide, mémoire technique, recommandations)
- Le profil COMPLET de l'entreprise (compétences, moyens, certifications, références, expériences passées)
- Les données DCE enrichies si disponibles

Ton rôle :
1. Analyser la structure de l'AO et identifier les postes de coûts
2. Poser des questions ciblées sur les coûts réels de l'entreprise (main d'œuvre, matériaux, sous-traitance, frais généraux)
3. Proposer une stratégie de prix compétitive en tenant compte des critères d'attribution
4. Aider à décomposer le prix par lots si nécessaire
5. Conseiller sur les marges en fonction du contexte concurrentiel
6. **Exploiter activement les références et projets passés similaires** pour calibrer les prix suggérés
7. **Comparer les certifications détenues par l'entreprise** avec celles potentiellement requises ou valorisées dans l'AO
8. **Adapter les marges** en fonction de la taille de l'entreprise, de son expérience dans ce type de marché et de sa capacité (moyens humains/matériels)
9. **Construire des arguments commerciaux** (pricing_arguments) en mettant en avant les forces concrètes du profil : certifications, références similaires, moyens dédiés, expérience terrain

Sois conversationnel et pose les questions une par une. Quand tu as suffisamment d'informations, utilise le tool save_pricing pour sauvegarder la stratégie commerciale.

IMPORTANT : N'invente jamais de prix. Demande toujours à l'utilisateur ses coûts réels. Tu peux suggérer des fourchettes basées sur le marché et les références passées similaires, mais l'utilisateur valide toujours.`;

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

    const { messages, tender_id, pipeline_item_id } = await req.json();
    if (!tender_id) throw new Error("tender_id requis");

    // Fetch context data including DCE downloads
    const [tenderRes, profileRes, analysesRes, dceRes] = await Promise.all([
      supabase.from("tenders").select("*").eq("id", tender_id).single(),
      supabase.from("profiles").select("*").eq("user_id", user.id).single(),
      supabase.from("tender_analyses").select("*").eq("tender_id", tender_id).eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("dce_downloads").select("enriched_data").eq("tender_id", tender_id).eq("user_id", user.id).not("enriched_data", "is", null),
    ]);

    const tender = tenderRes.data;
    const profile = profileRes.data;
    const analyses = analysesRes.data || [];
    const dceData = dceRes.data || [];

    if (!tender) throw new Error("Tender introuvable");

    const analysisTexts = analyses.map((a: any) => `[${a.analysis_type}]\n${a.result || ""}`).join("\n\n---\n\n");

    const dceTexts = dceData
      .filter((d: any) => d.enriched_data)
      .map((d: any) => JSON.stringify(d.enriched_data))
      .join("\n\n---\n\n");

    const referencesJson = profile?.company_references
      ? JSON.stringify(profile.company_references)
      : "Aucune référence renseignée";

    const contextPrompt = `CONTEXTE DE L'APPEL D'OFFRES :
- Titre : ${tender.title}
- Objet : ${tender.object || "Non précisé"}
- Acheteur : ${tender.buyer_name || "Non précisé"}
- Montant estimé : ${tender.estimated_amount ? `${tender.estimated_amount} €` : "Non communiqué"}
- Critères d'attribution : ${tender.award_criteria || "Non précisés"}
- Lots : ${tender.lots && Array.isArray(tender.lots) && tender.lots.length > 0 ? JSON.stringify(tender.lots) : "Marché global (pas de lots)"}
- Description : ${tender.description || "Non disponible"}
- Conditions de participation : ${tender.participation_conditions || "Non précisées"}
- Lieu d'exécution : ${tender.execution_location || "Non précisé"}
- Type de contrat : ${tender.contract_type || "Non précisé"}
- Type de procédure : ${tender.procedure_type || "Non précisé"}
- Codes CPV : ${tender.cpv_codes && tender.cpv_codes.length > 0 ? tender.cpv_codes.join(", ") : "Non renseignés"}
- Département : ${tender.department || "Non précisé"}
- Région : ${tender.region || "Non précisée"}
- Date limite : ${tender.deadline || "Non précisée"}

ENTREPRISE (PROFIL COMPLET) :
- Nom : ${profile?.company_name || "Non renseigné"}
- SIREN : ${profile?.siren || "Non renseigné"}
- Taille : ${profile?.company_size || "Non renseignée"}
- Description : ${profile?.company_description || "Non renseignée"}
- Secteurs : ${(profile?.sectors as string[])?.join(", ") || "Non renseignés"}
- Régions : ${(profile?.regions as string[])?.join(", ") || "Non renseignées"}
- Mots-clés : ${(profile?.keywords as string[])?.join(", ") || "Non renseignés"}
- Compétences : ${profile?.company_skills || "Non renseignées"}
- Certifications : ${(profile?.company_certifications as string[])?.join(", ") || "Aucune"}
- Moyens humains : ${profile?.company_team || "Non renseignés"}
- Moyens matériels : ${profile?.company_equipment || "Non renseignés"}
- Expériences passées : ${profile?.company_past_work || "Non renseignées"}
- Références projets : ${referencesJson}

ANALYSES IA EXISTANTES :
${analysisTexts || "Aucune analyse disponible"}

${dceTexts ? `DONNÉES DCE ENRICHIES :\n${dceTexts}` : ""}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY non configurée");

    const aiMessages = [
      { role: "system", content: systemPrompt + "\n\n" + contextPrompt },
      ...(messages || []),
    ];

    // If no user messages, add a starter
    if (!messages || messages.length === 0) {
      aiMessages.push({
        role: "user",
        content: "Bonjour, j'aimerais préparer ma réponse commerciale pour cet appel d'offres.",
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
        messages: aiMessages,
        stream: true,
        tools: [
          {
            type: "function",
            function: {
              name: "save_pricing",
              description: "Sauvegarde la stratégie de chiffrage quand toutes les informations ont été collectées",
              parameters: {
                type: "object",
                properties: {
                  global_price: { type: "number", description: "Prix global proposé en euros" },
                  margin_percentage: { type: "number", description: "Pourcentage de marge appliqué" },
                  strategy_summary: { type: "string", description: "Résumé de la stratégie commerciale" },
                  cost_breakdown: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string" },
                        amount: { type: "number" },
                        description: { type: "string" },
                      },
                      required: ["label", "amount"],
                      additionalProperties: false,
                    },
                    description: "Décomposition des coûts par poste",
                  },
                  lots_pricing: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        lot_number: { type: "string" },
                        lot_title: { type: "string" },
                        price: { type: "number" },
                      },
                      required: ["lot_number", "price"],
                      additionalProperties: false,
                    },
                    description: "Prix par lot si applicable",
                  },
                  pricing_arguments: { type: "string", description: "Argumentaire justifiant le prix proposé, en mettant en avant les forces du profil entreprise (certifications, références similaires, moyens)" },
                },
                required: ["global_price", "strategy_summary", "cost_breakdown"],
                additionalProperties: false,
              },
            },
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("Erreur IA");
    }

    // Stream response back
    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (err) {
    console.error("generate-pricing-strategy error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
