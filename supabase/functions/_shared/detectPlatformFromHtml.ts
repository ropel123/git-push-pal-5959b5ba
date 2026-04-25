// Détection déterministe de plateforme via signatures DOM dans le HTML brut.
// Aucun appel IA — pure pattern-matching, gratuit, traçable.
// Retourne null si aucune signature trouvée (passe le relais à l'IA).

export type HtmlSignatureMatch = {
  platform: string;
  confidence: number;
  evidence: string;       // bout de HTML qui a matché (≤120 chars)
  pagination_hint: "url" | "actions" | "single" | "unknown";
};

// Liste ordonnée par spécificité (premier match gagne).
// Chaque règle : un platform + une regex à chercher dans le HTML lowercased.
const SIGNATURES: Array<{
  platform: string;
  patterns: RegExp[];
  confidence: number;
  pagination_hint: HtmlSignatureMatch["pagination_hint"];
}> = [
  // ATEXO / LocalTrust / SDM (le plus déployé en France, signatures très distinctives)
  {
    platform: "atexo",
    patterns: [
      /class="[^"]*atexo[-_][a-z0-9]/i,
      /id="[^"]*atexo[-_][a-z0-9]/i,
      /\/app_atexo\//i,
      /atexo[-_]mpe/i,
      /localtrust/i,
      /name="form_consultations"/i,
      /name="ctl00\$mainplaceholder/i, // SDM/LocalTrust ASP.NET viewstate
      /\?page=entreprise\.entrepriseadvancedsearch/i, // pattern URL canonique SDM
      /\/sdm\/ent2\//i,
    ],
    confidence: 0.97,
    pagination_hint: "actions",
  },
  // MPI (ColdFusion)
  {
    platform: "mpi",
    patterns: [
      /\.cfm\?fuseaction=/i,
      /marches-publics\.info/i,
      /mpi-fragment/i,
      /<meta[^>]+content="marches[- ]publics\.info"/i,
    ],
    confidence: 0.95,
    pagination_hint: "actions",
  },
  // PLACE (état)
  {
    platform: "place",
    patterns: [
      /place\.marches-publics\.gouv\.fr/i,
      /projets-achats\.marches-publics\.gouv\.fr/i,
      /<title[^>]*>[^<]*place[^<]*<\/title>/i,
    ],
    confidence: 0.97,
    pagination_hint: "url",
  },
  // OMNIKLES
  {
    platform: "omnikles",
    patterns: [
      /omnikles/i,
      /\/okmarche\//i,
      /\/xmarches\/okmarche\//i,
    ],
    confidence: 0.95,
    pagination_hint: "url",
  },
  // KLEKOON
  {
    platform: "klekoon",
    patterns: [
      /klekoon/i,
      /class="[^"]*\bklk[-_]/i,
    ],
    confidence: 0.97,
    pagination_hint: "url",
  },
  // ACHATPUBLIC
  {
    platform: "achatpublic",
    patterns: [
      /achatpublic\.com/i,
      /achat-public\.com/i,
    ],
    confidence: 0.97,
    pagination_hint: "url",
  },
  // E-MARCHESPUBLICS
  {
    platform: "e-marchespublics",
    patterns: [
      /e-marchespublics\.com/i,
    ],
    confidence: 0.97,
    pagination_hint: "url",
  },
  // MARCHES-SECURISES
  {
    platform: "marches-securises",
    patterns: [
      /marches-securises\.fr/i,
    ],
    confidence: 0.97,
    pagination_hint: "url",
  },
  // SAFETENDER (strict : "safetender" littéral)
  {
    platform: "safetender",
    patterns: [
      /safetender/i,
    ],
    confidence: 0.95,
    pagination_hint: "actions",
  },
  // AWS-Achat
  {
    platform: "aws",
    patterns: [
      /aws-achat/i,
      /aws[- ]group/i,
      /<meta[^>]+content="[^"]*aws[- ]achat/i,
    ],
    confidence: 0.9,
    pagination_hint: "url",
  },
  // EU-Supply / CTM
  {
    platform: "eu-supply",
    patterns: [
      /eu-supply\.com/i,
      /ctm[- ]solution/i,
    ],
    confidence: 0.95,
    pagination_hint: "url",
  },
  // Synapse
  {
    platform: "synapse",
    patterns: [
      /synapse-entreprises\.com/i,
    ],
    confidence: 0.97,
    pagination_hint: "url",
  },
  // Centrale des marchés
  {
    platform: "centrale-marches",
    patterns: [
      /centraledesmarches\.com/i,
    ],
    confidence: 0.97,
    pagination_hint: "url",
  },
  // France Marchés
  {
    platform: "francemarches",
    patterns: [
      /francemarches\.com/i,
    ],
    confidence: 0.97,
    pagination_hint: "url",
  },
  // AJI
  {
    platform: "aji",
    patterns: [
      /aji-france\.com/i,
      /\/mapa\/marche/i,
    ],
    confidence: 0.9,
    pagination_hint: "url",
  },
  // Domino (Lotus Notes)
  {
    platform: "domino",
    patterns: [
      /\?openform/i,
      /\?readform/i,
      /\.nsf\//i,
      /lotus[- ]domino/i,
    ],
    confidence: 0.9,
    pagination_hint: "actions",
  },
  // MAXIMILIEN (IDF)
  {
    platform: "maximilien",
    patterns: [
      /maximilien\.fr/i,
    ],
    confidence: 0.95,
    pagination_hint: "url",
  },
  // MEGALIS Bretagne
  {
    platform: "megalis",
    patterns: [
      /megalis\.bretagne\.bzh/i,
    ],
    confidence: 0.95,
    pagination_hint: "url",
  },
  // TERNUM BFC
  {
    platform: "ternum",
    patterns: [
      /ternum-bfc\.fr/i,
    ],
    confidence: 0.95,
    pagination_hint: "url",
  },
  // AURA
  {
    platform: "aura",
    patterns: [
      /marchespublics\.auvergnerhonealpes\.eu/i,
    ],
    confidence: 0.95,
    pagination_hint: "url",
  },
];

/**
 * Cherche une signature de plateforme dans le HTML.
 * Retourne null si aucune signature trouvée → passe le relais à l'IA.
 */
export function detectPlatformFromHtml(html: string): HtmlSignatureMatch | null {
  if (!html || html.length < 100) return null;

  for (const sig of SIGNATURES) {
    for (const pattern of sig.patterns) {
      const match = html.match(pattern);
      if (match) {
        // Capture ~120 chars autour du match pour la traçabilité
        const idx = match.index ?? 0;
        const start = Math.max(0, idx - 30);
        const end = Math.min(html.length, idx + match[0].length + 30);
        const evidence = html.slice(start, end).replace(/\s+/g, " ").trim().slice(0, 120);

        return {
          platform: sig.platform,
          confidence: sig.confidence,
          evidence,
          pagination_hint: sig.pagination_hint,
        };
      }
    }
  }

  return null;
}
