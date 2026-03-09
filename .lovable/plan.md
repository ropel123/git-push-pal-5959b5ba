

# Plan : Corriger le parser BOAMP pour supporter toutes les familles (MAPA, FNSimple, etc.)

## Probleme

Le parser `parseBoampDonnees` ne fonctionne que pour les notices `FNSimple`. Les notices `MAPA` (marches < 90k) ont une structure JSON completement differente, ce qui explique pourquoi l'AO 26-23770 n'a aucun detail.

### Differences de structure

```text
FNSimple                              MAPA
─────────                             ────
organisme.nomOfficiel                 organisme.acheteurPublic
organisme.codeIdentificationNational  (absent)
organisme.ville / cp                  organisme.adr.ville / cp
initial.communication.nomContact      organisme.correspondantPRM.nom
initial.communication.adresseMailContact  organisme.coord.mel
initial.communication.telContact      organisme.coord.tel
initial.natureMarche.intitule         (absent)
initial.natureMarche.description      initial.description.objet
initial.procedure.capaciteExercice    initial.justifications.*
initial.procedure.criteresAttrib      initial.criteres.critereCDC
(absent)                              initial.duree.dateACompterDu/Jusquau
```

## Solution

Refaire `parseBoampDonnees` pour chercher les donnees dans les deux emplacements possibles avec des fallbacks :

| Donnee | Chemin 1 (FNSimple) | Chemin 2 (MAPA) |
|---|---|---|
| Email | `initial.communication.adresseMailContact` | `organisme.coord.mel` |
| Tel | `initial.communication.telContact` | `organisme.coord.tel` |
| Contact name | `initial.communication.nomContact` | `organisme.correspondantPRM.nom` |
| Adresse | `organisme.ville + cp` | `organisme.adr.ville + cp + voie.nomvoie` |
| SIRET | `organisme.codeIdentificationNational` | (absent) |
| Description | `initial.natureMarche.description` | `initial.description.objet` |
| Titre | `initial.natureMarche.intitule` | `initial.description.objet` |
| URL profil | `initial.communication.urlProfilAch` | `organisme.urlProfilAcheteur` |
| Lieu execution | `initial.natureMarche.lieuExecution` | (absent, fallback top-level) |
| Criteres | `initial.procedure.criteresAttrib` | `initial.criteres` (texte ou ref CDC) |
| Conditions | `initial.procedure.capaciteExercice` | `initial.justifications` (liste de champs) |
| Duree | (absent) | `initial.duree` → additional_info |
| Ref marche | `initial.communication.identifiantInterne` | `initial.renseignements.idMarche` |
| CPV | `initial.natureMarche.codeCPV` | (absent, fallback top-level `descripteur_code`) |

### Fichier modifie
- `supabase/functions/scrape-boamp/index.ts` : refaire `parseBoampDonnees` avec multi-path fallback

### Post-deploiement
- Re-executer le scraper pour backfill les ~400 AO BOAMP existantes

