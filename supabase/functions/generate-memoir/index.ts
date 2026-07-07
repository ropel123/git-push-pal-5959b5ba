import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es un expert en appels d'offres et tu échanges avec un chef d'entreprise pour construire son mémoire technique.

Tu dois mener un entretien conversationnel, simple, fluide et professionnel, afin de récolter des informations solides, concrètes et directement utilisables.

IMPORTANT — DÉBUT DE L'ENTRETIEN :
Commence par accueillir brièvement le dirigeant, puis demande-lui :
1. Le nom de son entreprise
2. Son numéro SIREN
3. La taille de l'entreprise (nombre de salariés)
4. Son site web (si il en a un)

Si l'utilisateur fournit un site web, appelle immédiatement le tool "analyze_website" pour récupérer le contenu du site. Utilise ces informations pour pré-remplir ta compréhension de l'entreprise (description, compétences, certifications visibles, références, etc.) et pose des questions plus ciblées.

Ta façon d'agir :
- pose une question à la fois,
- fais parler le dirigeant avec des questions simples,
- repère immédiatement les réponses vagues ou trop générales,
- relance automatiquement avec une question plus précise,
- cherche toujours du concret : chiffres, organisation, exemples, preuves, références, délais, moyens,
- reformule régulièrement les réponses dans un style professionnel,
- n'invente jamais rien.

Quand une réponse est trop vague, tu relances automatiquement avec des formulations comme :
- "Pouvez-vous me donner un exemple concret ?"
- "Combien cela représente-t-il ?"
- "Comment cela se passe-t-il en pratique ?"
- "Qui intervient exactement ?"
- "Avec quels moyens ?"
- "Avez-vous un chiffre ou un indicateur ?"
- "Qu'est-ce qui vous différencie objectivement sur ce point ?"

Tu organises l'entretien autour de ces thèmes :
1. présentation de l'entreprise,
2. certifications et conformité,
3. compétences clés,
4. moyens humains,
5. moyens matériels et techniques,
6. méthodologie d'exécution,
7. qualité / sécurité / environnement,
8. références et preuves,
9. organisation pour le marché visé,
10. éléments différenciants.

Pour chaque thème :
- commence par une question ouverte,
- relance si nécessaire,
- continue jusqu'à obtenir une matière exploitable,
- puis rédige :
  - un résumé professionnel,
  - les points forts à valoriser,
  - les informations encore manquantes.

À la fin, rédige :
- une synthèse complète,
- les points différenciants,
- la liste des manques,
- une trame de mémoire technique,
- une première version rédigée des principales rubriques.

Quand tu as suffisamment d'informations, appelle le tool "save_memoir" pour sauvegarder le mémoire technique ET les informations d'entreprise collectées. Inclus tous les champs possibles : nom, SIREN, taille, secteurs, régions, mots-clés, site web, description, certifications, compétences, équipe, équipements, travaux passés, références.

Commence maintenant par accueillir le dirigeant brièvement, puis pose la première question sur son entreprise.`;

const SAVE_MEMOIR_TOOL = {
  type: "function",
  function: {
    name: "save_memoir",
    description: "Sauvegarde le mémoire technique structuré ET les informations d'entreprise une fois toutes les informations collectées et confirmées par l'utilisateur",
    parameters: {
      type: "object",
      properties: {
        company_name: {
          type: "string",
          description: "Nom de l'entreprise",
        },
        siren: {
          type: "string",
          description: "Numéro SIREN de l'entreprise",
        },
        company_size: {
          type: "string",
          description: "Taille de l'entreprise (ex: 1-9, 10-49, 50-249, 250-999, 1000+)",
        },
        sectors: {
          type: "array",
          items: { type: "string" },
          description: "Secteurs d'activité de l'entreprise",
        },
        regions: {
          type: "array",
          items: { type: "string" },
          description: "Zones géographiques ciblées",
        },
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "Mots-clés métier pour le scoring des appels d'offres",
        },
        company_website: {
          type: "string",
          description: "URL du site web de l'entreprise",
        },
        company_description: {
          type: "string",
          description: "Description enrichie de l'entreprise",
        },
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
      },
      required: ["company_skills", "company_team"],
      additionalProperties: false,
    },
  },
};

const ANALYZE_WEBSITE_TOOL = {
  type: "function",
  function: {
    name: "analyze_website",
    description: "Analyse le site web de l'entreprise pour extraire des informations utiles (description, compétences, certifications, références, etc.)",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL du site web à analyser",
        },
      },
      required: ["url"],
      additionalProperties: false,
    },
  },
};

function buildProfileContext(profile: Record<string, unknown> | null): string {
  if (!profile) return "";
  const parts: string[] = [];
  if (profile.company_name) parts.push(`Nom: ${profile.company_name}`);
  if (profile.company_description) parts.push(`Description: ${profile.company_description}`);
  if ((profile.sectors as string[] | null)?.length) parts.push(`Secteurs: ${(profile.sectors as string[]).join(", ")}`);
  if (profile.company_size) parts.push(`Taille: ${profile.company_size}`);
  if ((profile.company_certifications as string[] | null)?.length) parts.push(`Certifications: ${(profile.company_certifications as string[]).join(", ")}`);
  if (profile.company_skills) parts.push(`Compétences: ${profile.company_skills}`);
  if (profile.company_team) parts.push(`Équipe: ${profile.company_team}`);
  if (profile.company_equipment) parts.push(`Équipements: ${profile.company_equipment}`);
  if (profile.company_past_work) parts.push(`Travaux: ${profile.company_past_work}`);
  if (profile.company_references && Array.isArray(profile.company_references) && (profile.company_references as unknown[]).length > 0) {
    parts.push(`Références: ${JSON.stringify(profile.company_references)}`);
  }
  if (parts.length === 0) return "";
  return `\n\nINFORMATIONS DÉJÀ CONNUES SUR L'ENTREPRISE :\n${parts.join("\n")}\n\nTiens compte de ces informations et ne redemande pas ce qui est déjà renseigné. Approfondis plutôt ce qui manque.`;
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

async function fetchWebsiteContent(url: string): Promise<string> {
  let formattedUrl = url.trim();
  if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
    formattedUrl = `https://${formattedUrl}`;
  }
  
  // Try Firecrawl first if available
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (firecrawlKey) {
    try {
      console.log(`[memoir] Using Firecrawl to scrape ${formattedUrl}`);
      const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${firecrawlKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: formattedUrl, formats: ["markdown"], onlyMainContent: true }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const markdown = data.data?.markdown || data.markdown;
        if (markdown) return markdown.slice(0, 8000);
      }
    } catch (e) {
      console.warn("[memoir] Firecrawl failed, falling back to direct fetch:", e);
    }
  }

  // Fallback: direct fetch
  console.log(`[memoir] Direct fetch for ${formattedUrl}`);
  const resp = await fetch(formattedUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; MemoirBot/1.0)" },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const html = await resp.text();
  return stripHtmlToText(html);
}

interface AIProvider {
  url: string;
  key: string;
  model: string;
  name: string;
  extraHeaders: Record<string, string>;
}

function getOpenRouterProvider(apiKey: string): AIProvider {
  return {
    url: "https://openrouter.ai/api/v1/chat/completions",
    key: apiKey,
    model: "anthropic/claude-sonnet-4",
    name: "openrouter",
    extraHeaders: {
      "HTTP-Referer": "https://lovable.dev",
      "X-Title": "Memoir AI Agent",
    },
  };
}

function getLovableProvider(apiKey: string): AIProvider {
  return {
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    key: apiKey,
    model: "google/gemini-2.5-pro",
    name: "lovable",
    extraHeaders: {},
  };
}

async function callAI(provider: AIProvider, body: Record<string, unknown>): Promise<Response> {
  console.log(`[memoir] Calling provider=${provider.name} model=${provider.model}`);
  const resp = await fetch(provider.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.key}`,
      "Content-Type": "application/json",
      ...provider.extraHeaders,
    },
    body: JSON.stringify({ model: provider.model, ...body }),
  });
  console.log(`[memoir] provider=${provider.name} status=${resp.status}`);
  return resp;
}

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

    const { messages, analyze_website_url } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle analyze_website tool call from client
    if (analyze_website_url) {
      try {
        const content = await fetchWebsiteContent(analyze_website_url);
        return new Response(JSON.stringify({ website_content: content }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: `Impossible d'analyser le site: ${e instanceof Error ? e.message : "Erreur"}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const profileContext = buildProfileContext(profile);

    const requestBody = {
      messages: [
        { role: "system", content: SYSTEM_PROMPT + profileContext },
        ...messages,
      ],
      stream: true,
      tools: [SAVE_MEMOIR_TOOL, ANALYZE_WEBSITE_TOOL],
    };

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!OPENROUTER_API_KEY && !LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Aucune clé API configurée" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let aiResponse: Response | null = null;

    if (OPENROUTER_API_KEY) {
      const provider = getOpenRouterProvider(OPENROUTER_API_KEY);
      aiResponse = await callAI(provider, requestBody);
      if (!aiResponse.ok && [400, 404, 422].includes(aiResponse.status)) {
        const errText = await aiResponse.text();
        console.warn(`[memoir] OpenRouter failed (${aiResponse.status}): ${errText}. Falling back.`);
        aiResponse = null;
      }
    }

    if (!aiResponse && LOVABLE_API_KEY) {
      const provider = getLovableProvider(LOVABLE_API_KEY);
      aiResponse = await callAI(provider, requestBody);
    }

    if (!aiResponse) {
      return new Response(JSON.stringify({ error: "Aucun provider AI disponible" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      console.error(`[memoir] AI error: ${status} ${errText}`);
      return new Response(JSON.stringify({ error: `Erreur IA (${status})` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("[memoir] error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
