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

  it("décode les entités HTML (« &amp; ») qui cassaient les URLs au clic", () => {
    // Cas réel : 23 % des dce_url contenaient « &amp; » littéral — le paramètre
    // devenait « amp;type= » et la plateforme ne trouvait pas la consultation.
    const donnees = JSON.stringify({
      urlprofilacheteur:
        "https://www.marches-publics.info/index.cfm?fuseaction=dematEnt.login&amp;type=DCE&amp;IDM=123456",
      resume_objet: "Fourniture &amp; pose de menuiseries &#39;bois&#39;",
    });
    const p = parseBoampDonnees(donnees);
    expect(p.dce_url).toBe(
      "https://www.marches-publics.info/index.cfm?fuseaction=dematEnt.login&type=DCE&IDM=123456",
    );
    expect(p.description).toBe("Fourniture & pose de menuiseries 'bois'");
  });

  it("décode aussi le double-encodage (&amp;amp;)", () => {
    const donnees = JSON.stringify({
      accessurl: "https://www.achatpublic.com/sdm/ent2/gen/fichecsl.action?Pcslid=Csl_1&amp;amp;orgAcronyme=x",
    });
    expect(parseBoampDonnees(donnees).dce_url).toBe(
      "https://www.achatpublic.com/sdm/ent2/gen/fichecsl.action?Pcslid=Csl_1&orgAcronyme=x",
    );
  });
});

describe("parseBoampDonnees — contact/adresse/NUTS scopés sur l'acheteur", () => {
  // Cas réel : l'avis eForms liste l'opérateur de publication (AWS France,
  // Seyssinet-Pariset) AVANT l'acheteur — l'ancien parseur prenait ses
  // coordonnées comme « contact acheteur ».
  const donneesDeuxOrgs = JSON.stringify({
    EFORMS: {
      ContractNotice: {
        nomacheteur: "SM Manche Numérique",
        "efac:Organizations": {
          "efac:Organization": [
            {
              "efac:Company": {
                "cac:PartyName": { "cbc:Name": "AWS France" },
                "cac:Contact": { "cbc:ElectronicMail": "publications-joue@aws-france.com", "cbc:Telephone": "+33480041260" },
                "cac:PostalAddress": { "cbc:StreetName": "97 rue du Général Mangin", "cbc:PostalZone": "38170", "cbc:CityName": "Seyssinet-Pariset", "cbc:CountrySubentityCode": "FRK24" },
              },
            },
            {
              "efac:Company": {
                "cac:PartyName": { "cbc:Name": "SM Manche Numérique" },
                "cac:Contact": { "cbc:ElectronicMail": "marches@manchenumerique.fr", "cbc:Telephone": "+33233051234" },
                "cac:PostalAddress": { "cbc:StreetName": "235 rue Joseph Cugnot", "cbc:PostalZone": "50000", "cbc:CityName": "Saint-Lô", "cbc:CountrySubentityCode": "FRD12" },
              },
            },
          ],
        },
      },
    },
  });

  it("prend le contact de l'acheteur, pas celui de l'opérateur de publication", () => {
    const p = parseBoampDonnees(donneesDeuxOrgs);
    expect(p.buyer_contact?.email).toBe("marches@manchenumerique.fr");
    expect(p.buyer_contact?.ville).toBe("Saint-Lô");
  });

  it("prend l'adresse et le NUTS de l'acheteur, pas ceux de l'opérateur", () => {
    const p = parseBoampDonnees(donneesDeuxOrgs);
    expect(p.buyer_address).toContain("Saint-Lô");
    expect(p.buyer_address).not.toContain("Seyssinet");
    expect(p.nuts_code).toBe("FRD12");
  });

  it("sans nom d'acheteur appariable, écarte quand même les organisations opérateur", () => {
    const donnees = JSON.stringify({
      "efac:Organizations": {
        "efac:Organization": [
          { "efac:Company": { "cac:PartyName": { "cbc:Name": "AWS France" }, "cac:Contact": { "cbc:ElectronicMail": "publications-joue@aws-france.com" } } },
          { "efac:Company": { "cac:PartyName": { "cbc:Name": "Commune de Test" }, "cac:Contact": { "cbc:ElectronicMail": "mairie@test.fr" } } },
        ],
      },
    });
    expect(parseBoampDonnees(donnees).buyer_contact?.email).toBe("mairie@test.fr");
  });
});
