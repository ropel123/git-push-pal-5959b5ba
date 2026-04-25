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
On te donne UNE URL. Tu DOIS :
1. Utiliser l'outil web_fetch pour récupérer le contenu HTML de cette URL.
2. Analyser : hostname, path, scripts, classes CSS, hidden inputs, meta tags, footer, mentions légales.
3. Renvoyer ton verdict via l'outil \`classify_platform\` et UNIQUEMENT via cet outil.

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
1. Confidence ∈ [0,1]. Calibration OBLIGATOIRE :
   - 0.95–1.00 : signature explicite et incontestable (hostname connu, classe CSS spécifique, script JS de la plateforme, mention dans le footer/mentions légales).
   - 0.80–0.94 : 2 indices convergents (ex : structure de path typique + meta generator + footer cohérent).
   - 0.65–0.79 : 1 indice fort OU plusieurs indices faibles convergents — RÉPONSE ACCEPTABLE, ne te sous-évalue pas.
   - < 0.65 : tu hésites vraiment entre 2+ plateformes ou aucun signal exploitable → renvoie alors platform: "custom" avec la confidence réelle.
   N'utilise "custom" avec une confidence ≥ 0.65 QUE si tu es sûr qu'aucune plateforme connue ne correspond (portail métier maison, ASP.NET propriétaire, etc.).
2. pagination_hint :
   - "url" si pagination par paramètre d'URL (?page=N, &offset=)
   - "actions" si formulaire POST / boutons JS (Atexo SDM, MPI ColdFusion, Domino)
   - "single" si pas de pagination visible (1 seule page de résultats)
   - "unknown" si tu ne peux pas trancher
3. reasoning : UNE phrase courte (<200 caractères) citant la signature qui t'a convaincu.`;

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

      // Seuil de confiance : sous CONFIDENCE_THRESHOLD → on rétrograde sur custom
      if (confidence < CONFIDENCE_THRESHOLD && platform !== "custom") {
        console.warn(`[aiClassifierAnthropic] low confidence ${confidence} for ${platform} → custom (threshold=${CONFIDENCE_THRESHOLD})`);
        return { platform: "custom", confidence, reasoning: `low-confidence:${platform}:${reasoning}`, pagination_hint };
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
