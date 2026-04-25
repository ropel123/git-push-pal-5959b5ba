// Classification de plateforme via Anthropic API directe + Claude Haiku 4.5
// + outil server-side web_fetch_20250910 (Anthropic fetche l'URL pour nous).
// 1 seul appel API : on envoie l'URL → Claude fetche → Claude appelle notre tool → on lit la réponse.

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

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_VERSION = "2023-06-01";
const ANTHROPIC_BETA = "web-fetch-2025-09-10";
const CONFIDENCE_THRESHOLD = 0.65;

const SYSTEM_PROMPT = `Tu es un expert français des plateformes de marchés publics (DCE, profils acheteurs).
Tu reçois UNE URL et tu dois identifier la plateforme technique qui propulse ce portail.

PROCESSUS OBLIGATOIRE :
1. Tente web_fetch sur l'URL pour récupérer le HTML.
2. Si web_fetch RÉUSSIT : analyse le DOM (scripts, classes CSS, hidden inputs, meta generator, footer, mentions légales). Tu DOIS citer textuellement dans 'reasoning' au moins UN fragment de HTML ou un nom d'attribut/classe qui prouve ta réponse (entre guillemets).
3. Si web_fetch ÉCHOUE (timeout, 403, 404, blocage) : NE RENONCE PAS. Classifie sur l'URL seule (hostname + path + query string). Mentionne dans 'reasoning' "url-only:" suivi du pattern reconnu.
4. Renvoie ton verdict via l'outil \`classify_platform\` UNIQUEMENT.

Liste exhaustive des plateformes possibles (enum fermé) :
- atexo : LocalTrust / SDM / atexo-mpe / app_atexo. Marqueurs : classes/IDs commençant par "atexo-", script "/app_atexo/", URL contenant "?page=Entreprise.EntrepriseAdvancedSearch", "/sdm/", form "form_consultations". Hébergeurs régionaux : AMP Métropole, Nantes Métropole, Pays de la Loire, Grand Nancy, Grand Lyon, Aquitaine, Lorraine, Demat-AMPA, Marchés Publics Hôpitaux, Alsace MP, RECIA Centre-Val de Loire (solaere.recia.fr).
- mpi : marches-publics.info, ColdFusion (.cfm?fuseaction=), Grand Est. Marqueurs : extension .cfm, querystring fuseaction=.
- place : marches-publics.gouv.fr (PLACE / Plateforme des Achats de l'État), projets-achats.marches-publics.gouv.fr.
- achatpublic : achatpublic.com.
- e-marchespublics : e-marchespublics.com.
- marches-securises : marches-securises.fr.
- klekoon : klekoon.com (classes klk-*).
- xmarches : xmarches.fr.
- maximilien : maximilien.fr (Île-de-France).
- megalis : megalis.bretagne.bzh.
- ternum : ternum-bfc.fr (Bourgogne-Franche-Comté).
- aura : marchespublics.auvergnerhonealpes.eu.
- safetender : UNIQUEMENT si "safetender" littéralement dans le hostname OU asset/script safetender. JAMAIS pour un SDM/LocalTrust générique.
- omnikles : *.omnikles.com, /okmarche/, /xmarches/okmarche/.
- aws : AWS-Achat / AWS Group (achats publics, pas Amazon Web Services).
- eu-supply : eu-supply.com / CTM Solution.
- synapse : synapse-entreprises.com.
- centrale-marches : centraledesmarches.com.
- francemarches : francemarches.com.
- aji : AJI (aji-france.com, /mapa/marche/).
- domino : Lotus/Notes Domino. Marqueurs : ?OpenForm, ?ReadForm, *.nsf/.
- custom : SEULEMENT si tu as inspecté le HTML (ou l'URL si fetch failed) et qu'il n'y a aucun marqueur d'une des 21 plateformes ci-dessus. Une mairie hébergée chez un éditeur SaaS (Omnikles, Atexo, etc.) n'est JAMAIS "custom" — cherche le footer/mentions légales.

RÈGLES :
1. Confidence ∈ [0,1]. Calibration :
   - 0.95–1.00 : signature explicite (classe CSS spécifique, hostname connu, script JS de la plateforme, footer avec nom de l'éditeur).
   - 0.80–0.94 : 2 indices convergents (pattern URL + meta generator par exemple).
   - 0.65–0.79 : 1 indice fort. RÉPONSE ACCEPTABLE — ne te sous-évalue pas, le système n'applique pas de seuil.
   - 0.30–0.64 : tu hésites mais tu as un soupçon → renvoie ta meilleure hypothèse, pas custom.
   - < 0.30 : aucun indice exploitable → "custom".
2. pagination_hint : "url" (?page=N), "actions" (form POST/JS), "single" (1 page), "unknown" si tu ne peux pas trancher.
3. reasoning (<240 chars) : OBLIGATOIREMENT citer le marqueur entre guillemets. Ex : 'class="atexo-recherche"', 'meta generator="LocalTrust"', 'url-only: "?page=Entreprise.EntrepriseAdvancedSearch" → SDM/Atexo'.`;

const TOOLS = [
  {
    type: "web_fetch_20250910",
    name: "web_fetch",
    max_uses: 2,
    max_content_tokens: 8000,
  },
  {
    name: "classify_platform",
    description: "Classifie l'URL de portail de marchés publics français.",
    input_schema: {
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
];

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max);
}

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

/**
 * Classifie une URL via Claude Haiku 4.5 + web_fetch (Anthropic direct).
 * Retourne toujours un résultat (jamais throw) : fallback "custom" si erreur.
 */
export async function classifyPlatformWithAnthropic(
  url: string
): Promise<AIClassificationResult> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    console.warn("[aiClassifierAnthropic] ANTHROPIC_API_KEY missing → custom fallback");
    return { platform: "custom", confidence: 0, reasoning: "no-api-key", pagination_hint: "unknown" };
  }

  const body = {
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: TOOLS,
    tool_choice: { type: "auto" },
    messages: [
      {
        role: "user",
        content: `Classifie cette URL de marché public français : ${url}\n\nUtilise web_fetch pour la récupérer, puis appelle classify_platform avec ton verdict.`,
      },
    ],
  };

  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "anthropic-beta": ANTHROPIC_BETA,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (res.status === 429 || res.status >= 500) {
        const txt = await res.text().catch(() => "");
        console.warn(`[aiClassifierAnthropic] HTTP ${res.status} attempt ${attempt}/${MAX_ATTEMPTS}: ${truncate(txt, 200)}`);
        if (attempt < MAX_ATTEMPTS) {
          await sleep(1000 * Math.pow(2, attempt - 1));
          continue;
        }
        return { platform: "custom", confidence: 0, reasoning: `http-${res.status}`, pagination_hint: "unknown" };
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.warn(`[aiClassifierAnthropic] HTTP ${res.status}: ${truncate(txt, 300)}`);
        return { platform: "custom", confidence: 0, reasoning: `http-${res.status}`, pagination_hint: "unknown" };
      }

      const json = await res.json();
      // Cherche le tool_use classify_platform dans le content array
      const content = Array.isArray(json?.content) ? json.content : [];
      const toolUse = content.find(
        (c: any) => c?.type === "tool_use" && c?.name === "classify_platform"
      );
      if (!toolUse?.input) {
        console.warn("[aiClassifierAnthropic] no classify_platform tool_use in response", JSON.stringify(content).slice(0, 300));
        return { platform: "custom", confidence: 0, reasoning: "no-tool-use", pagination_hint: "unknown" };
      }

      const parsed = toolUse.input;
      const platform = PLATFORM_ENUM.includes(parsed.platform) ? parsed.platform : "custom";
      let confidence = typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0;
      const reasoning = typeof parsed.reasoning === "string" ? truncate(parsed.reasoning, 240) : "";
      const pagination_hint = PAGINATION_ENUM.includes(parsed.pagination_hint) ? parsed.pagination_hint : "unknown";

      // Pas de filtre : on fait confiance au verdict de l'agent (web_fetch + inspection DOM).
      // Si l'agent renvoie "custom" c'est qu'il a inspecté et n'a rien trouvé.
      if (confidence < CONFIDENCE_THRESHOLD) {
        console.warn(`[aiClassifierAnthropic] low confidence ${confidence} for ${platform} (kept anyway)`);
      }

      return { platform, confidence, reasoning, pagination_hint };
    } catch (err) {
      console.warn(`[aiClassifierAnthropic] error attempt ${attempt}/${MAX_ATTEMPTS}:`, err instanceof Error ? err.message : String(err));
      if (attempt < MAX_ATTEMPTS) {
        await sleep(1000 * Math.pow(2, attempt - 1));
        continue;
      }
      return { platform: "custom", confidence: 0, reasoning: "network-error", pagination_hint: "unknown" };
    }
  }
  return { platform: "custom", confidence: 0, reasoning: "exhausted", pagination_hint: "unknown" };
}
