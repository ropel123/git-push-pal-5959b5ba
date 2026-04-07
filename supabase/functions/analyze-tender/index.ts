import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
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

    const { tender_id, analysis_type } = await req.json();

    if (!tender_id || !analysis_type) {
      return new Response(JSON.stringify({ error: "tender_id et analysis_type requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch tender + profile data
    const [tenderRes, profileRes] = await Promise.all([
      supabase.from("tenders").select("*").eq("id", tender_id).single(),
      supabase.from("profiles").select("*").eq("user_id", user.id).single(),
    ]);

    const tender = tenderRes.data;
    const profile = profileRes.data;

    if (tenderRes.error || !tender) {
      return new Response(JSON.stringify({ error: "Appel d'offres introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch uploaded DCE files info
    const { data: dceUploads } = await supabase
      .from("dce_uploads")
      .select("*")
      .eq("tender_id", tender_id)
      .eq("user_id", user.id);

    // Build context from tender data
    let tenderContext = `
APPEL D'OFFRES:
Titre: ${tender.title}
${tender.object ? `Objet: ${tender.object}` : ""}
${tender.description ? `Description: ${tender.description}` : ""}
${tender.buyer_name ? `Acheteur: ${tender.buyer_name}` : ""}
${tender.estimated_amount ? `Montant estimé: ${tender.estimated_amount} €` : ""}
${tender.procedure_type ? `Procédure: ${tender.procedure_type}` : ""}
${tender.contract_type ? `Type de contrat: ${tender.contract_type}` : ""}
${tender.deadline ? `Date limite: ${tender.deadline}` : ""}
${tender.region ? `Région: ${tender.region}` : ""}
${tender.execution_location ? `Lieu d'exécution: ${tender.execution_location}` : ""}
${tender.award_criteria ? `Critères d'attribution: ${tender.award_criteria}` : ""}
${tender.participation_conditions ? `Conditions de participation: ${tender.participation_conditions}` : ""}
${tender.additional_info ? `Informations complémentaires: ${tender.additional_info}` : ""}
${tender.lots && Array.isArray(tender.lots) && tender.lots.length > 0 ? `Lots: ${JSON.stringify(tender.lots)}` : ""}
${tender.cpv_codes && tender.cpv_codes.length > 0 ? `Codes CPV: ${tender.cpv_codes.join(", ")}` : ""}
`.trim();

    // Try to read DCE file contents (PDF text extraction)
    if (dceUploads && dceUploads.length > 0) {
      tenderContext += "\n\nDOCUMENTS DCE UPLOADÉS:";
      for (const upload of dceUploads) {
        if (upload.file_name.toLowerCase().endsWith(".pdf")) {
          // Download the file
          const { data: fileData } = await supabase.storage
            .from("dce-documents")
            .download(upload.file_path);
          if (fileData) {
            const text = await fileData.text();
            // Only include if it looks like extractable text (not binary)
            if (text && text.length > 100 && !text.includes("\x00")) {
              tenderContext += `\n\n--- ${upload.file_name} ---\n${text.substring(0, 50000)}`;
            } else {
              tenderContext += `\n\n[Fichier ${upload.file_name} uploadé mais contenu binaire non extractible]`;
            }
          }
        } else {
          tenderContext += `\n\n[Fichier ${upload.file_name} uploadé]`;
        }
      }
    }

    // Add company context from memoir
    if (profile) {
      const companyParts = [];
      if (profile.company_name) companyParts.push(`Nom: ${profile.company_name}`);
      if (profile.company_description) companyParts.push(`Description: ${profile.company_description}`);
      if (profile.sectors?.length) companyParts.push(`Secteurs: ${(profile.sectors as string[]).join(", ")}`);
      if (profile.company_certifications?.length) companyParts.push(`Certifications: ${(profile.company_certifications as string[]).join(", ")}`);
      if (profile.company_skills) companyParts.push(`Compétences: ${profile.company_skills}`);
      if (profile.company_team) companyParts.push(`Moyens humains: ${profile.company_team}`);
      if (profile.company_equipment) companyParts.push(`Moyens matériels: ${profile.company_equipment}`);
      if (profile.company_past_work) companyParts.push(`Travaux réalisés: ${profile.company_past_work}`);
      if (profile.company_references && Array.isArray(profile.company_references) && (profile.company_references as any[]).length > 0) {
        companyParts.push(`Références: ${JSON.stringify(profile.company_references)}`);
      }
      if (companyParts.length > 0) {
        tenderContext += `\n\nPROFIL DE L'ENTREPRISE CANDIDATE :\n${companyParts.join("\n")}`;
      }
    }

    // System prompts per analysis type
    const systemPrompts: Record<string, string> = {
      quick: `Tu es un expert en marchés publics français. Analyse l'appel d'offres ci-dessous et fournis:
1. **Résumé** (3-5 phrases)
2. **Matching entreprise / AO** : Compare les exigences de l'AO avec le profil de l'entreprise candidate. Indique le taux de correspondance sur : compétences, certifications requises vs détenues, zone géographique, références similaires, capacité financière. Si des certifications ou compétences manquent, liste-les explicitement.
3. **Recommandation Go/No-Go** avec justification basée sur le matching
4. **Points clés** à retenir (5-7 points)
5. **Risques identifiés**
6. **Estimation de la charge de travail** pour répondre

Sois concis et actionnable. Base ton analyse sur les données réelles du profil de l'entreprise fourni ci-dessous.`,

      technical: `Tu es un expert en rédaction de mémoires techniques pour les marchés publics français.
À partir des informations de l'appel d'offres ET du profil de l'entreprise candidate, génère un **brouillon structuré de mémoire technique** comprenant:

1. **Page de garde** (titre du marché, nom de l'entreprise candidate, date)
2. **Présentation de l'entreprise** — utilise les informations réelles du profil (description, certifications, compétences). Ne mets [À COMPLÉTER] que pour les données absentes du profil.
3. **Compréhension du besoin** (reformulation du cahier des charges)
4. **Méthodologie proposée** (approche technique détaillée, en lien avec les compétences de l'entreprise)
5. **Moyens humains** — utilise les données réelles du profil si disponibles (équipe, compétences)
6. **Moyens matériels et logistiques** — utilise les données réelles du profil si disponibles
7. **Planning prévisionnel**
8. **Démarche qualité et environnementale** — mentionne les certifications réelles détenues
9. **Références similaires** — utilise les références réelles du profil. Mets en avant celles qui sont similaires à l'AO.
10. **Valeur ajoutée et engagements**

IMPORTANT : Utilise les données réelles du profil de l'entreprise pour pré-remplir chaque section. Ne mets [À COMPLÉTER] que pour les informations absentes du profil.`,

      strategy: `Tu es un consultant senior en stratégie de réponse aux marchés publics français. Analyse cet appel d'offres et fournis:

1. **Analyse stratégique du marché** (contexte, enjeux, concurrence probable)
2. **Forces et faiblesses de l'entreprise candidate** par rapport à cet AO — analyse les compétences, certifications, références et moyens du profil vs les exigences de l'AO. Identifie les gaps de compétences ou certifications manquantes.
3. **Points de différenciation** possibles basés sur le profil réel de l'entreprise
4. **Stratégie de prix** recommandée (en tenant compte de la taille de l'entreprise et du montant estimé)
5. **Critères d'attribution** : comment maximiser le score sur chaque critère avec les atouts de l'entreprise
6. **Pièges à éviter**
7. **Argumentaire clé** à développer en s'appuyant sur les références et compétences réelles
8. **Alliances/sous-traitance** potentielles pour combler les éventuels gaps identifiés
9. **Calendrier de réponse** recommandé

Sois stratégique et orienté vers la victoire. Base ton analyse sur le profil réel de l'entreprise.`,
    };

    const systemPrompt = systemPrompts[analysis_type] || systemPrompts.quick;

    // Call Lovable AI Gateway
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
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: tenderContext },
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
      console.error("AI Gateway error:", status, errText);
      return new Response(JSON.stringify({ error: "Erreur IA: " + status }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const result = aiData.choices?.[0]?.message?.content || "Aucun résultat";
    const tokensUsed = aiData.usage?.total_tokens || null;

    // Save analysis
    await supabase.from("tender_analyses").insert({
      tender_id,
      user_id: user.id,
      analysis_type,
      result,
      model_used: "google/gemini-2.5-flash",
      tokens_used: tokensUsed,
    });

    return new Response(JSON.stringify({ result, tokens_used: tokensUsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-tender error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
