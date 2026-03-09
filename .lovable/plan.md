

# Plan : Extraire les donnees detaillees des AO (BOAMP + TED)

## Constat

Le champ `donnees` du BOAMP contient un JSON extremement riche qu'on ignore completement. Voici ce qu'il contient et qu'on ne stocke pas :

**BOAMP — champ `donnees` (JSON complet de l'avis)**
| Donnee | Champ dans `donnees` | Stockage actuel |
|--------|---------------------|-----------------|
| Description complete du marche | `OBJET.OBJET_COMPLET` | Rien (on ne met que `objet` = resume) |
| Titre officiel du marche | `OBJET.TITRE_MARCHE` | Non |
| Adresse acheteur (rue, CP, ville) | `IDENTITE.ADRESSE/CP/VILLE` | Non |
| Email / tel acheteur | `IDENTITE.MEL/TEL` | Non |
| SIRET / type pouvoir adjudicateur | `TYPE_POUVOIR_ADJUDICATEUR` | Non |
| Codes CPV detailles (avec libelles) | `OBJET.CPV[].PRINCIPAL` | On a les codes BOAMP, pas les CPV officiels |
| Lieu d'execution + code NUTS | `OBJET.LIEU_EXEC_LIVR.CODE_NUTS` | Non |
| Criteres d'attribution | `PROCEDURE.CRITERES_ATTRIBUTION` | Non |
| Conditions de participation | `PROCEDURE.CONDITION_PARTICIPATION` | Non |
| Lots detailles | `OBJET.CARACTERISTIQUES.DIV_EN_LOTS` | Non |
| Montant / quantites | `OBJET.CARACTERISTIQUES.QUANTITE` | Non |
| Renseignements complementaires | `PROCEDURE.RENSEIGNEMENTS_COMPLEMENTAIRES` | Non |
| Reference du marche | `PROCEDURE.CONDITION_ADMINISTRATIVE.REFERENCE_MARCHE` | Non |

**TED — champs supplementaires dans l'API Search v3**
| Donnee | Champ API | Stockage actuel |
|--------|-----------|-----------------|
| Description du lot | `description-lot` | Juste le texte basique |
| Lieu d'execution | `place-of-performance` | Non |
| Nature du contrat | `contract-nature` | Non |
| Ville acheteur | `buyer-city` | Non |
| Pays acheteur | `buyer-country` | Non |

## Solution

### 1. Migration DB : nouvelles colonnes pour les donnees riches

Ajouter a la table `tenders` :
- `description text` — description complete du marche (OBJET_COMPLET pour BOAMP)
- `buyer_address text` — adresse complete de l'acheteur
- `buyer_contact jsonb` — email, tel, ville de l'acheteur
- `execution_location text` — lieu d'execution
- `nuts_code text` — code NUTS (geolocalisation europeenne)
- `contract_type text` — type de marche (travaux/services/fournitures)
- `award_criteria text` — criteres d'attribution
- `participation_conditions text` — conditions de participation
- `additional_info text` — renseignements complementaires

### 2. `scrape-boamp/index.ts` : parser le champ `donnees`

Le champ `donnees` est un JSON stringifie. On le parse et on extrait :
- `donnees.OBJET.OBJET_COMPLET` → `description`
- `donnees.OBJET.TITRE_MARCHE` → meilleur `title`
- `donnees.OBJET.CPV[].PRINCIPAL` → vrais codes CPV officiels
- `donnees.OBJET.LIEU_EXEC_LIVR` → `execution_location` + `nuts_code`
- `donnees.IDENTITE` → `buyer_address`, `buyer_contact`
- `donnees.PROCEDURE.CRITERES_ATTRIBUTION` → `award_criteria`
- `donnees.PROCEDURE.CONDITION_PARTICIPATION` → `participation_conditions`
- `donnees.PROCEDURE.RENSEIGNEMENTS_COMPLEMENTAIRES` → `additional_info`
- `donnees.OBJET.TYPE_MARCHE` → `contract_type`
- On recupere aussi `descripteur_libelle` (libelles CPV en francais) depuis les champs top-level

### 3. `scrape-ted/index.ts` : champs supplementaires

- Ajouter `place-of-performance`, `contract-nature`, `buyer-country`, `buyer-city` dans `fields`
- Mapper vers `execution_location`, `contract_type`, `nuts_code`
- Fix : dedupliquer CPV codes, stocker `null` au lieu de `0` pour montants

### 4. `TenderDetail.tsx` : afficher les nouvelles donnees

Ajouter les sections :
- **Description du marche** : bloc texte complet
- **Lieu d'execution** : localisation + code NUTS
- **Criteres d'attribution** : texte des criteres
- **Conditions de participation** : capacite technique, economique, juridique
- **Informations complementaires** : renseignements divers
- **Contact acheteur** : adresse, email, tel
- Lien vers l'avis source (`source_url`)
- Badge `contract_type` (Travaux/Services/Fournitures)

## Fichiers modifies
- Migration SQL : ajout colonnes
- `supabase/functions/scrape-boamp/index.ts` : parser `donnees`
- `supabase/functions/scrape-ted/index.ts` : champs supplementaires + fixes
- `src/pages/TenderDetail.tsx` : affichage enrichi

## Ordre
1. Migration DB (nouvelles colonnes)
2. Enrichir scraper BOAMP (parser `donnees`)
3. Enrichir scraper TED (champs supplementaires + fixes qualite)
4. Mettre a jour l'affichage TenderDetail
5. Re-executer les 2 scrapers pour backfill

