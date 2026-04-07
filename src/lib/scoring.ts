interface TenderForScoring {
  title: string;
  object: string | null;
  region: string | null;
  department: string | null;
  cpv_codes: string[] | null;
  estimated_amount: number | null;
  award_criteria?: string | null;
  participation_conditions?: string | null;
  description?: string | null;
}

interface ProfileForScoring {
  keywords: string[] | null;
  regions: string[] | null;
  sectors: string[] | null;
  company_size: string | null;
  company_certifications?: string[] | null;
  company_skills?: string | null;
  company_references?: any[] | null;
}

export function computeScore(tender: TenderForScoring, profile: ProfileForScoring): number {
  let score = 0;

  // Full tender text for matching
  const tenderText = `${tender.title} ${tender.object ?? ""} ${tender.description ?? ""} ${tender.award_criteria ?? ""} ${tender.participation_conditions ?? ""}`.toLowerCase();

  // 1. Keyword matching (weight: 25)
  const keywords = profile.keywords ?? [];
  if (keywords.length > 0) {
    const matches = keywords.filter((kw) => tenderText.includes(kw.toLowerCase()));
    score += (matches.length / keywords.length) * 25;
  } else {
    score += 12.5;
  }

  // 2. Region matching (weight: 20)
  const regions = profile.regions ?? [];
  if (regions.length > 0 && tender.region) {
    if (regions.some((r) => r.toLowerCase() === tender.region!.toLowerCase())) {
      score += 20;
    }
  } else {
    score += 10;
  }

  // 3. CPV / Sector matching (weight: 15)
  const sectors = profile.sectors ?? [];
  const cpv = tender.cpv_codes ?? [];
  if (sectors.length > 0 && cpv.length > 0) {
    const match = sectors.some((s) => cpv.some((c) => c.startsWith(s.slice(0, 2))));
    if (match) score += 15;
  } else {
    score += 7.5;
  }

  // 4. Amount vs company size (weight: 10)
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

  // 5. Certifications matching (weight: 10)
  const certs = profile.company_certifications ?? [];
  if (certs.length > 0) {
    const certMatches = certs.filter((cert) => tenderText.includes(cert.toLowerCase()));
    if (certMatches.length > 0) {
      score += 10;
    } else {
      // Has certs but none match this tender — partial credit
      score += 4;
    }
  } else {
    score += 3; // No certs in profile — low neutral
  }

  // 6. Skills matching (weight: 15)
  const skills = profile.company_skills ?? "";
  if (skills.trim()) {
    const skillWords = skills.toLowerCase().split(/[\s,;.]+/).filter((w) => w.length > 3);
    if (skillWords.length > 0) {
      const matchCount = skillWords.filter((w) => tenderText.includes(w)).length;
      const ratio = Math.min(1, matchCount / Math.min(skillWords.length, 10));
      score += ratio * 15;
    } else {
      score += 7.5;
    }
  } else {
    score += 5; // No skills in profile — low neutral
  }

  // 7. References bonus (weight: 5)
  const refs = profile.company_references;
  if (Array.isArray(refs) && refs.length > 0) {
    score += 5;
  } else {
    score += 1; // No references — minimal
  }

  return Math.round(Math.min(100, score));
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
