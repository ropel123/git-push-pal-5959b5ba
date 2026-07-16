import { describe, it, expect } from "vitest";
// Fonctions de normalisation partagées avec les edge functions de scraping.
// normalize.ts est du TS pur (aucune référence Deno) → importable sous vitest.
import {
  parseFrenchDate,
  parseAmount,
  detectDeptFromText,
} from "../../supabase/functions/_shared/normalize";

describe("parseFrenchDate", () => {
  it("parse les mois français textuels (cause n°1 des deadlines perdues)", () => {
    expect(parseFrenchDate("08 Juin 2026 11:00")?.slice(0, 10)).toBe("2026-06-08");
    expect(parseFrenchDate("3 décembre 2026 12h30")?.slice(0, 10)).toBe("2026-12-03");
    expect(parseFrenchDate("1 janvier 2027")?.slice(0, 10)).toBe("2027-01-01");
    expect(parseFrenchDate("15 août 2026")?.slice(0, 10)).toBe("2026-08-15");
  });
  it("conserve les formats ISO et DD/MM/YYYY", () => {
    expect(parseFrenchDate("2026-04-23")?.slice(0, 10)).toBe("2026-04-23");
    expect(parseFrenchDate("03/06/2026 12:00")?.slice(0, 10)).toBe("2026-06-03");
  });
  it("renvoie null sur du texte non-date", () => {
    expect(parseFrenchDate("bientôt")).toBeNull();
    expect(parseFrenchDate("")).toBeNull();
  });
});

describe("parseAmount", () => {
  it("renvoie null pour une chaîne vide (pas un faux 0)", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("   ")).toBeNull();
    expect(parseAmount("N/A")).toBeNull();
  });
  it("parse les vrais montants", () => {
    expect(parseAmount("0")).toBe(0);
    expect(parseAmount("2 700 000 €")).toBe(2700000);
    expect(parseAmount("150000")).toBe(150000);
  });
});

describe("detectDeptFromText", () => {
  it("reconnaît les noms de département", () => {
    expect(detectDeptFromText("Seine-Maritime")).toBe("76");
    expect(detectDeptFromText("Hauts-de-Seine")).toBe("92");
    expect(detectDeptFromText("La Réunion")).toBe("974");
  });
  it("préfère le nom composé au nom simple", () => {
    expect(detectDeptFromText("Charente-Maritime")).toBe("17");
    expect(detectDeptFromText("Charente")).toBe("16");
  });
  it("ne matche pas un nom court à l'intérieur d'un mot (précision)", () => {
    // "ain" ne doit pas matcher "Saint-Nazaire" ; on retombe sur le code (44)
    expect(detectDeptFromText("Saint-Nazaire (44)")).toBe("44");
  });
  it("retombe sur le code numérique isolé", () => {
    expect(detectDeptFromText("Lot 44 - voirie")).toBe("44");
    expect(detectDeptFromText("")).toBeNull();
  });
});
