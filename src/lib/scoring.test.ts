import { describe, it, expect } from "vitest";
import { hasScorableProfile, computeScore, type ProfileForScoring, type TenderForScoring } from "./scoring";

const emptyProfile: ProfileForScoring = {
  keywords: null,
  regions: null,
  sectors: null,
  company_size: null,
  company_certifications: null,
  company_skills: null,
  company_references: null,
};

const tender: TenderForScoring = {
  title: "Travaux de voirie",
  object: null,
  region: "Île-de-France",
  department: null,
  cpv_codes: null,
  estimated_amount: null,
};

describe("hasScorableProfile", () => {
  it("est faux pour un profil entièrement vide", () => {
    expect(hasScorableProfile(emptyProfile)).toBe(false);
    expect(hasScorableProfile(null)).toBe(false);
    expect(hasScorableProfile(undefined)).toBe(false);
  });

  it("est vrai dès qu'un champ de matching est renseigné", () => {
    expect(hasScorableProfile({ ...emptyProfile, keywords: ["voirie"] })).toBe(true);
    expect(hasScorableProfile({ ...emptyProfile, regions: ["Île-de-France"] })).toBe(true);
    expect(hasScorableProfile({ ...emptyProfile, company_size: "10-49" })).toBe(true);
    expect(hasScorableProfile({ ...emptyProfile, company_skills: "  " })).toBe(false); // blanc = vide
    expect(hasScorableProfile({ ...emptyProfile, company_skills: "génie civil" })).toBe(true);
  });
});

describe("computeScore (contexte du faux 44)", () => {
  it("renvoie 44 pour un profil vide — précisément la constante à ne pas afficher", () => {
    expect(computeScore(tender, emptyProfile)).toBe(44);
  });

  it("varie selon l'AO dès que le profil est renseigné", () => {
    const profile = { ...emptyProfile, keywords: ["voirie"], regions: ["Île-de-France"] };
    const match = computeScore(tender, profile);
    const noMatch = computeScore({ ...tender, title: "Fourniture de repas", region: "Bretagne" }, profile);
    expect(match).not.toBe(noMatch);
    expect(match).toBeGreaterThan(noMatch);
  });
});
