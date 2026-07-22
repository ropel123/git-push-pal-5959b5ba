import { describe, it, expect } from "vitest";
import { isGenericLink, isPublisherUrl, resolveTenderUrls } from "./urlDisplay";

describe("isGenericLink", () => {
  it("considère null/vide/non parsable comme générique", () => {
    expect(isGenericLink(null)).toBe(true);
    expect(isGenericLink("")).toBe(true);
    expect(isGenericLink("pas une url")).toBe(true);
  });

  it("détecte les racines de plateforme sans identifiant (cas Maximilien)", () => {
    expect(isGenericLink("https://marches.maximilien.fr/entreprise")).toBe(true);
    expect(isGenericLink("https://marches.maximilien.fr/")).toBe(true);
    expect(isGenericLink("https://www.achatpublic.com/accueil")).toBe(true);
    expect(isGenericLink("https://plateforme.fr/index.php")).toBe(true);
    expect(isGenericLink("https://plateforme.fr/fr/entreprise/")).toBe(true);
  });

  it("accepte les liens profonds vers une consultation", () => {
    expect(isGenericLink("https://plateforme.fr/consultation/1234")).toBe(false);
    expect(isGenericLink("https://marches.maximilien.fr/?page=Entreprise.EntrepriseDetailsConsultation&refConsultation=12345&orgAcronyme=maxim")).toBe(false);
    expect(isGenericLink("https://plateforme.fr/entreprise?idConsultation=987")).toBe(false);
  });

  it("détecte les listings MPI sans identifiant de consultation", () => {
    expect(isGenericLink("https://mpi.fr/?fuseaction=pub.affPublication")).toBe(true);
    expect(isGenericLink("https://mpi.fr/?fuseaction=pub.affPublication&refCons=1234")).toBe(false);
    expect(isGenericLink("https://mpi.fr/?fuseaction=pub.affPublication&IDS=99")).toBe(false);
  });

  it("détecte les pages de recherche/résultats", () => {
    expect(isGenericLink("https://x.fr/?fuseaction=pub.affResultats")).toBe(true);
    expect(isGenericLink("https://x.fr/entreprise?page=recherche")).toBe(true);
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
  it("sans avis éditeur : le lien profond de plateforme sert de lien principal", () => {
    const r = resolveTenderUrls({ source_url: "https://plateforme.fr/consultation/42", dce_url: null });
    expect(r.officialUrl).toBe("https://plateforme.fr/consultation/42");
    expect(r.officialLabel).toBe("Voir l'avis original");
    expect(r.isPublisherFallback).toBe(false);
    expect(r.platformUrl).toBeNull();
  });

  it("cas majoritaire réel : source_url BOAMP + dce_url racine générique → l'avis BOAMP est le lien principal, la racine devient platformUrl", () => {
    const r = resolveTenderUrls({
      source_url: "https://www.boamp.fr/avis/detail/26-72690",
      dce_url: "https://marches.maximilien.fr/entreprise",
    });
    expect(r.officialUrl).toBe("https://www.boamp.fr/avis/detail/26-72690");
    expect(r.officialLabel).toBe("Voir l'avis original (BOAMP)");
    expect(r.isPublisherFallback).toBe(true);
    expect(r.dceUrl).toBeNull(); // la racine n'est PAS présentée comme un accès DCE
    expect(r.platformUrl).toBe("https://marches.maximilien.fr/entreprise");
  });

  it("libellé TED quand l'avis vient de TED", () => {
    const r = resolveTenderUrls({ source_url: "https://ted.europa.eu/fr/notice/123", dce_url: null });
    expect(r.officialLabel).toBe("Voir l'avis original (TED)");
  });

  it("structure uniforme : avis BOAMP en lien principal, lien profond réservé au bouton DCE (pas de doublon)", () => {
    const r = resolveTenderUrls({
      source_url: "https://www.boamp.fr/avis/detail/26-1",
      dce_url: "https://plateforme.fr/dce/42",
    });
    expect(r.officialUrl).toBe("https://www.boamp.fr/avis/detail/26-1");
    expect(r.officialLabel).toBe("Voir l'avis original (BOAMP)");
    expect(r.dceUrl).toBe("https://plateforme.fr/dce/42");
    expect(r.platformUrl).toBeNull();
  });

  it("sans avis éditeur ni lien profond : listing enrichi en lien principal", () => {
    const r = resolveTenderUrls({
      source_url: null,
      dce_url: "https://mpi.fr/?fuseaction=pub.affPublication",
      enriched_data: { listing_url: "https://plateforme.fr/liste?refCons=88" },
    });
    expect(r.officialUrl).toBe("https://plateforme.fr/liste?refCons=88");
    expect(r.isFallbackOnly).toBe(true);
    expect(r.officialLabel).toBe("Voir sur la plateforme acheteur");
  });

  it("ne rend JAMAIS zéro lien si une URL existe", () => {
    const r = resolveTenderUrls({ source_url: "https://www.boamp.fr/avis/detail/26-2", dce_url: null });
    expect(r.officialUrl).toBe("https://www.boamp.fr/avis/detail/26-2");
  });

  it("retourne null uniquement quand aucune URL n'existe", () => {
    const r = resolveTenderUrls({ source_url: null, dce_url: "" });
    expect(r.officialUrl).toBeNull();
    expect(r.dceUrl).toBeNull();
    expect(r.platformUrl).toBeNull();
  });
});
