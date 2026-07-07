export const KNOWN_CATEGORIES = [
  "atexo", "place", "mpi", "dematis", "achatpublic",
  "marches-securises", "klekoon", "xmarches", "safetender",
  "aws", "synapse", "centrale-marches", "francemarches", "aji",
  "eu-supply", "domino", "bravo", "autre-mp", "anjou", "inconnu",
];

export const normalizeCat = (c: string | null | undefined) => {
  if (!c || c === "autre" || c === "inconnu") return "inconnu";
  return c;
};

export const categoryColor = (c: string | null | undefined) => {
  const n = normalizeCat(c);
  if (n === "inconnu") return "bg-muted text-muted-foreground";
  if (n === "place") return "bg-primary/10 text-primary";
  if (n === "atexo") return "bg-accent/40 text-foreground";
  return "bg-secondary text-secondary-foreground";
};

export const platformToCategory = (platform: string | null | undefined): string => {
  if (!platform) return "inconnu";
  const map: Record<string, string> = {
    atexo: "atexo", aura: "atexo", ternum: "atexo",
    maximilien: "atexo", megalis: "atexo",
    mpi: "mpi", place: "place", achatpublic: "achatpublic",
    "e-marchespublics": "dematis", dematis: "dematis",
    "marches-securises": "marches-securises", klekoon: "klekoon",
    xmarches: "xmarches", safetender: "safetender", omnikles: "safetender",
    synapse: "synapse", "centrale-marches": "centrale-marches",
    francemarches: "francemarches", aji: "aji", "eu-supply": "eu-supply",
    domino: "domino", bravo: "bravo",
  };
  return map[platform] ?? platform;
};

export const fingerprintSourceFromEvidence = (
  evidence: unknown
): string | null => {
  if (!Array.isArray(evidence)) return null;
  const arr = evidence as string[];
  if (arr.some((e) => typeof e === "string" && e.startsWith("ai:"))) return "ai";
  if (arr.some((e) => typeof e === "string" && e.startsWith("hostname:"))) return "hostname";
  return arr.length > 0 ? "other" : null;
};
