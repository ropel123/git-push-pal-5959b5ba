interface TenderForScoring {
  title: string;
  object: string | null;
  region: string | null;
  department: string | null;
  cpv_codes: string[] | null;
  estimated_amount: number | null;
}

interface ProfileForScoring {
  keywords: string[] | null;
  regions: string[] | null;
  sectors: string[] | null;
  company_size: string | null;
}

export function computeScore(tender: TenderForScoring, profile: ProfileForScoring): number {
  let score = 0;
  let weights = 0;

  // Keyword matching (weight: 40)
  const keywords = profile.keywords ?? [];
  if (keywords.length > 0) {
    const text = `${tender.title} ${tender.object ?? ""}`.toLowerCase();
    const matches = keywords.filter((kw) => text.includes(kw.toLowerCase()));
    score += (matches.length / keywords.length) * 40;
  } else {
    score += 20; // neutral if no keywords set
  }
  weights += 40;

  // Region matching (weight: 30)
  const regions = profile.regions ?? [];
  if (regions.length > 0 && tender.region) {
    if (regions.some((r) => r.toLowerCase() === tender.region!.toLowerCase())) {
      score += 30;
    }
  } else {
    score += 15;
  }
  weights += 30;

  // CPV / Sector matching (weight: 20)
  const sectors = profile.sectors ?? [];
  const cpv = tender.cpv_codes ?? [];
  if (sectors.length > 0 && cpv.length > 0) {
    const match = sectors.some((s) => cpv.some((c) => c.startsWith(s.slice(0, 2))));
    if (match) score += 20;
  } else {
    score += 10;
  }
  weights += 20;

  // Amount vs company size (weight: 10)
  const amount = tender.estimated_amount;
  const size = profile.company_size;
  if (amount && size) {
    const sizeMax: Record<string, number> = {
      "1-9": 100_000,
      "10-49": 500_000,
      "50-249": 2_000_000,
      "250-999": 10_000_000,
      "1000+": Infinity,
    };
    const max = sizeMax[size] ?? Infinity;
    score += amount <= max ? 10 : 3;
  } else {
    score += 5;
  }
  weights += 10;

  return Math.round(Math.min(100, (score / weights) * 100));
}

export function getScoreColor(score: number): string {
  if (score >= 70) return "bg-green-500/20 text-green-400 border-green-500/30";
  if (score >= 40) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  return "bg-red-500/20 text-red-400 border-red-500/30";
}

export function getScoreLabel(score: number): string {
  if (score >= 70) return "Forte";
  if (score >= 40) return "Moyenne";
  return "Faible";
}
