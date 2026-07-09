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
});
