import { describe, it, expect } from "vitest";
// boampParse.ts est du TypeScript pur (aucune API Deno) : importable sous vitest
// pour couvrir en CI l'extraction du lien DCE depuis l'eForms BOAMP.
import { parseBoampDonnees } from "../../supabase/functions/_shared/boampParse";

describe("parseBoampDonnees — extraction dce_url", () => {
  it("extrait l'URL plateforme (WebsiteURI) d'un eForms", () => {
    const donnees = JSON.stringify({
      EFORMS: {
        ContractNotice: {
          "efac:Organizations": {
            "efac:Organization": {
              "efac:Company": {
                "cbc:WebsiteURI": "https://www.marches-securises.fr",
                "cbc:EndpointID": "http://www.covati.fr/",
              },
            },
          },
        },
      },
    });
    expect(parseBoampDonnees(donnees).dce_url).toBe("https://www.marches-securises.fr");
  });

  it("ignore le site propre de l'acheteur (non plateforme)", () => {
    const donnees = JSON.stringify({ "cbc:WebsiteURI": "https://www.ville-exemple.fr" });
    expect(parseBoampDonnees(donnees).dce_url).toBeUndefined();
  });

  it("ajoute https:// à une URL plateforme sans schéma", () => {
    const donnees = JSON.stringify({ urlprofilacheteur: "www.achatpublic.com/sdm/ent/gen/index.jsp" });
    expect(parseBoampDonnees(donnees).dce_url).toBe("https://www.achatpublic.com/sdm/ent/gen/index.jsp");
  });

  it("ne casse pas sur un donnees vide ou invalide", () => {
    expect(parseBoampDonnees("").dce_url).toBeUndefined();
    expect(parseBoampDonnees("pas du json").dce_url).toBeUndefined();
    expect(parseBoampDonnees(null).dce_url).toBeUndefined();
  });

  it("préfère le lien profond (consultation précise) à la racine générique", () => {
    // Cas réel : profil acheteur = racine achatpublic, mais l'avis contient
    // aussi le lien exact de la consultation (accessurl eForms).
    const donnees = JSON.stringify({
      urlprofilacheteur: "https://www.achatpublic.com/",
      accessurl: "https://www.achatpublic.com/sdm/ent2/gen/fichecsl.action?Pcslid=Csl_2026_ehv0s2yz52",
    });
    expect(parseBoampDonnees(donnees).dce_url).toBe(
      "https://www.achatpublic.com/sdm/ent2/gen/fichecsl.action?Pcslid=Csl_2026_ehv0s2yz52",
    );
  });

  it("repêche un lien profond présent uniquement dans le texte de l'avis", () => {
    const donnees = JSON.stringify({
      urlprofilacheteur: "https://www.maximilien.fr/",
      description: "Le DCE est téléchargeable sur https://demat.centraledesmarches.com/7048372 avant la date limite.",
    });
    expect(parseBoampDonnees(donnees).dce_url).toBe("https://demat.centraledesmarches.com/7048372");
  });

  it("retombe sur la racine plateforme quand aucun lien profond n'existe", () => {
    const donnees = JSON.stringify({ urlprofilacheteur: "https://www.maximilien.fr/" });
    expect(parseBoampDonnees(donnees).dce_url).toBe("https://www.maximilien.fr/");
  });
});
