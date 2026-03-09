

# Plan : Corriger le parser BOAMP pour la vraie structure `donnees`

## Probleme

Le parser `parseBoampDonnees` cherche des chemins comme `OBJET.OBJET_COMPLET`, `IDENTITE.MEL`, `PROCEDURE.CRITERES_ATTRIBUTION` qui n'existent pas. La vraie structure du JSON `donnees` est :

```text
donnees
└── FNSimple (ou autre famille)
    ├── organisme
    │   ├── nomOfficiel
    │   ├── codeIdentificationNational (SIRET)
    │   ├── ville, cp
    │   └── grpCommandes
    └── initial
        ├── communication
        │   ├── urlDocConsul
        │   ├── nomContact (email)
        │   └── telContact
        ├── procedure
        │   ├── capaciteEcoFin
        │   ├── capaciteTech
        │   ├── criteresAttrib
        │   ├── dateReceptionOffres
        │   └── techAchat
        ├── natureMarche
        │   ├── intitule (titre)
        │   ├── description (description complete)
        │   ├── codeCPV.objetPrincipal.classPrincipale
        │   ├── lieuExecution
        │   └── lotsMarche
        └── informComplementaire
            └── autresInformComplementaire
```

## Solution

Refaire `parseBoampDonnees` dans `scrape-boamp/index.ts` pour naviguer dans la vraie structure. Le JSON est enveloppe dans une cle de famille (`FNSimple`, `FNS`, `MAPA`, etc.) — on prend la premiere cle non-meta.

### Mapping corrige

| Source dans `donnees` | Destination |
|---|---|
| `*.organisme.codeIdentificationNational` | `buyer_siret` |
| `*.organisme.ville` + `cp` | `buyer_address` |
| `*.initial.communication.nomContact` | `buyer_contact.email` |
| `*.initial.communication.telContact` | `buyer_contact.tel` |
| `*.initial.communication.urlDocConsul` | `buyer_contact.url` |
| `*.initial.natureMarche.intitule` | `title` (meilleur) |
| `*.initial.natureMarche.description` | `description` |
| `*.initial.natureMarche.codeCPV.objetPrincipal.classPrincipale` | `cpv_codes` |
| `*.initial.natureMarche.lieuExecution` | `execution_location` |
| `*.initial.procedure.criteresAttrib` | `award_criteria` |
| `*.initial.procedure.capaciteEcoFin` + `capaciteTech` | `participation_conditions` |
| `*.initial.informComplementaire.autresInformComplementaire` | `additional_info` |
| `type_marche[0]` (top-level) | `contract_type` |
| Montant extrait du texte description (regex `XX XXX,XX euro`) | `estimated_amount` |

### Fichier modifie
- `supabase/functions/scrape-boamp/index.ts` : refaire `parseBoampDonnees` pour la vraie structure

### Post-deploiement
- Re-executer le scraper pour mettre a jour les ~400 AO BOAMP existantes

