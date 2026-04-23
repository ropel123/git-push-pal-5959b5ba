// Classification de plateforme via OpenRouter + Claude 3.5 Sonnet (tool calling).
// Réponse structurée garantie : enum fermé, confidence + reasoning + pagination_hint.

const PLATFORM_ENUM = [
  "atexo", "mpi", "place", "achatpublic", "e-marchespublics",
  "marches-securises", "klekoon", "xmarches", "maximilien",
  "megalis", "ternum", "aura", "safetender", "omnikles",
  "aws", "eu-supply", "synapse", "centrale-marches",
  "francemarches", "aji", "domino", "custom",
] as const;

const PAGINATION_ENUM = ["url", "actions", "single", "unknown"] as const;

export type AIClassificationResult = {
  platform: string;
  confidence: number;
  reasoning: string;
  pagination_hint: string;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "anthropic/claude-opus-4.7";

const SYSTEM_PROMPT = `Tu es un expert français des plateformes de marchés publics (DCE, profils acheteurs).
On te donne une URL + un extrait HTML + des en-têtes HTTP. Tu DOIS renvoyer ton verdict via l'outil \`classify_platform\` et UNIQUEMENT via cet outil.

Liste exhaustive des plateformes possibles (enum fermé) :
- atexo : LocalTrust / SDM / atexo-mpe / app_atexo, hébergeurs régionaux (AMP Métropole, Nantes Métropole, Pays de la Loire, Grand Nancy, Grand Lyon, Aquitaine, Lorraine, Demat-AMPA, Marchés Publics Hôpitaux, Alsace MP)
- mpi : marches-publics.info, ColdFusion (.cfm?fuseaction=), Grand Est
- place : marches-publics.gouv.fr (PLACE / Plateforme des Achats de l'État), projets-achats.marches-publics.gouv.fr
- achatpublic : achatpublic.com
- e-marchespublics : e-marchespublics.com
- marches-securises : marches-securises.fr
- klekoon : klekoon.com (classes klk-*)
- xmarches : xmarches.fr
- maximilien : maximilien.fr (Île-de-France)
- megalis : megalis.bretagne.bzh
- ternum : ternum-bfc.fr (Bourgogne-Franche-Comté)
- aura : marchespublics.auvergnerhonealpes.eu
- safetender : UNIQUEMENT si "safetender" littéralement dans le hostname OU asset/script safetender. Ne JAMAIS attribuer safetender à un SDM/LocalTrust.
- omnikles : portails Omnikles (omnikles.com, communes/EPCI)
- aws : AWS-Achat / AWS Group (achats publics, pas Amazon Web Services !)
- eu-supply : eu-supply.com / CTM Solution
- synapse : Synapse Entreprises (synapse-entreprises.com)
- centrale-marches : centraledesmarches.com
- francemarches : francemarches.com
- aji : AJI (Agence Juridique de l'Information, anciennes communes)
- domino : Lotus/Notes Domino (URLs avec ?OpenForm, ?ReadForm, /webmarche/...nsf)
- custom : si vraiment rien d'identifiable

RÈGLES :
1. Confidence ∈ [0,1]. Si tu hésites entre deux plateformes ou qu'aucun signal n'est clair → confidence < 0.6 et platform = "custom".
2. pagination_hint :
   - "url" si pagination par paramètre d'URL (?page=N, &offset=)
   - "actions" si formulaire POST / boutons JS (Atexo SDM, MPI ColdFusion, Domino)
   - "single" si pas de pagination visible (1 seule page de résultats)
   - "unknown" si tu ne peux pas trancher
3. reasoning : UNE phrase courte (<200 caractères) citant la signature qui t'a convaincu.`;

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "classify_platform",
    description: "Classifie l'URL de portail de marchés publics français.",
    parameters: {
      type: "object",
      properties: {
        platform: {
          type: "string",
          enum: PLATFORM_ENUM,
          description: "Identifiant normalisé de la plateforme.",
        },
        confidence: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description: "Score de confiance ∈ [0,1].",
        },
        reasoning: {
          type: "string",
          maxLength: 240,
          description: "1 phrase citant la signature décisive.",
        },
        pagination_hint: {
          type: "string",
          enum: PAGINATION_ENUM,
          description: "Mode de pagination détecté dans le DOM.",
        },
      },
      required: ["platform", "confidence", "reasoning", "pagination_hint"],
      additionalProperties: false,
    },
  },
};

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max);
}

function safeHeaders(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  const keep = ["server", "x-powered-by", "set-cookie", "content-type", "x-aspnet-version", "via"];
  for (const k of keep) {
    const v = h.get(k);
    if (v) out[k] = truncate(v, 200);
  }
  return out;
}

async function callOpenRouter(body: unknown, apiKey: string): Promise<Response> {
  return fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://hackify.fr",
      "X-Title": "Hackify Platform Classifier",
    },
    body: JSON.stringify(body),
  });
}

/**
 * Classifie une URL via Claude 3.5 Sonnet.
 * Retourne toujours un résultat (jamais throw) : fallback "custom" si erreur.
 */
export async function classifyPlatformWithAI(
  url: string,
  htmlSnippet: string,
  responseHeaders: Headers
): Promise<AIClassificationResult> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) {
    console.warn("[aiClassifier] OPENROUTER_API_KEY missing → custom fallback");
    return { platform: "custom", confidence: 0, reasoning: "no-api-key", pagination_hint: "unknown" };
  }

  const headersDict = safeHeaders(responseHeaders);
  const userMessage = [
    `URL: ${url}`,
    ``,
    `HTTP HEADERS:`,
    JSON.stringify(headersDict, null, 2),
    ``,
    `HTML EXTRACT (max 8KB) :`,
    truncate(htmlSnippet, 8000),
  ].join("\n");

  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    tools: [TOOL_SCHEMA],
    tool_choice: { type: "function", function: { name: "classify_platform" } },
    temperature: 0,
    max_tokens: 600,
  };

  let attempt = 0;
  while (attempt < 2) {
    attempt++;
    try {
      const res = await callOpenRouter(body, apiKey);

      if (res.status === 429) {
        console.warn(`[aiClassifier] 429 rate limit (attempt ${attempt}/2)`);
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.warn(`[aiClassifier] HTTP ${res.status}: ${truncate(txt, 200)}`);
        return { platform: "custom", confidence: 0, reasoning: `http-${res.status}`, pagination_hint: "unknown" };
      }

      const json = await res.json();
      const toolCall = json?.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        console.warn("[aiClassifier] no tool_call in response");
        return { platform: "custom", confidence: 0, reasoning: "no-tool-call", pagination_hint: "unknown" };
      }

      let parsed: any;
      try {
        parsed = JSON.parse(toolCall.function.arguments);
      } catch {
        console.warn("[aiClassifier] tool_call args not valid JSON");
        return { platform: "custom", confidence: 0, reasoning: "bad-json", pagination_hint: "unknown" };
      }

      const platform = PLATFORM_ENUM.includes(parsed.platform) ? parsed.platform : "custom";
      const confidence = typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0;
      const reasoning = typeof parsed.reasoning === "string" ? truncate(parsed.reasoning, 240) : "";
      const pagination_hint = PAGINATION_ENUM.includes(parsed.pagination_hint) ? parsed.pagination_hint : "unknown";

      return { platform, confidence, reasoning, pagination_hint };
    } catch (err) {
      console.warn(`[aiClassifier] error attempt ${attempt}:`, err instanceof Error ? err.message : String(err));
      if (attempt >= 2) {
        return { platform: "custom", confidence: 0, reasoning: "network-error", pagination_hint: "unknown" };
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return { platform: "custom", confidence: 0, reasoning: "exhausted", pagination_hint: "unknown" };
}
