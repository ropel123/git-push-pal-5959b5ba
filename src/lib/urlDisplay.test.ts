import { describe, it, expect } from "vitest";
import { isGenericLink, isPublisherUrl, resolveTenderUrls } from "./urlDisplay";

describe("isGenericLink", () => {
  it("considère null/vide comme générique", () => {
    expect(isGenericLink(null)).toBe(true);
    expect(isGenericLink("")).toBe(true);
  });

  it("détecte les listings MPI sans identifiant de consultation", () => {
    expect(isGenericLink("https://mpi.fr/?fuseaction=pub.affPublication")).toBe(true);
    expect(isGenericLink("https://mpi.fr/?fuseaction=pub.affPublication&refCons=1234")).toBe(false);
    expect(isGenericLink("https://mpi.fr/?fuseaction=pub.affPublication&IDS=99")).toBe(false);
  });

  it("détecte les pages de recherche/résultats", () => {
    expect(isGenericLink("https://x.fr/?fuseaction=pub.affResultats")).toBe(true);
    expect(isGenericLink("https://x.fr/entreprise?page=recherche")).toBe(true);
    expect(isGenericLink("https://plateforme.fr/consultation/1234")).toBe(false);
  });
});

describe("isPublisherUrl", () => {
  it("détecte BOAMP et TED", () => {
    expect(isPublisherUrl("https://www.boamp.fr/avis/detail/26-123")).toBe(true);
    expect(isPublisherUrl("https://ted.europa.eu/fr/notice/123")).toBe(true);
    expect(isPublisherUrl("https://www.marches-publics.gouv.fr/x")).toBe(false);
    expect(isPublisherUrl(null)).toBe(false);
  });
});

describe("resolveTenderUrls", () => {
  it("préfère un source_url de plateforme (cas idéal)", () => {
    const r = resolveTenderUrls({ source_url: "https://plateforme.fr/consultation/42", dce_url: null });
    expect(r.officialUrl).toBe("https://plateforme.fr/consultation/42");
    expect(r.officialLabel).toBe("Voir l'avis original");
    expect(r.isPublisherFallback).toBe(false);
  });

  it("retombe sur dce_url quand source_url est BOAMP", () => {
    const r = resolveTenderUrls({
      source_url: "https://www.boamp.fr/avis/detail/26-1",
      dce_url: "https://plateforme.fr/dce/42",
    });
    expect(r.officialUrl).toBe("https://plateforme.fr/dce/42");
    expect(r.dceUrl).toBe("https://plateforme.fr/dce/42");
  });

  it("ne rend JAMAIS zéro lien : fallback avis éditeur (bug « URLs pas cliquables »)", () => {
    // Cas majoritaire du stock actuel : source_url BOAMP, pas de dce_url.
    const r = resolveTenderUrls({ source_url: "https://www.boamp.fr/avis/detail/26-2", dce_url: null });
    expect(r.officialUrl).toBe("https://www.boamp.fr/avis/detail/26-2");
    expect(r.isPublisherFallback).toBe(true);
    expect(r.officialLabel).toContain("BOAMP");
  });

  it("utilise enriched_data.listing_url en fallback intermédiaire", () => {
    const r = resolveTenderUrls({
      source_url: "https://www.boamp.fr/avis/detail/26-3",
      dce_url: "https://mpi.fr/?fuseaction=pub.affPublication",
      enriched_data: { listing_url: "https://plateforme.fr/liste" },
    });
    expect(r.officialUrl).toBe("https://plateforme.fr/liste");
    expect(r.isFallbackOnly).toBe(true);
    expect(r.officialLabel).toBe("Voir sur la plateforme acheteur");
  });

  it("retourne null uniquement quand aucune URL n'existe", () => {
    const r = resolveTenderUrls({ source_url: null, dce_url: "" });
    expect(r.officialUrl).toBeNull();
    expect(r.dceUrl).toBeNull();
  });
});
