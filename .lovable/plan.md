

# Insertion des 10 URLs validées dans le sourcing

## Ce qui va être fait

### 1. Insertion des 10 URLs dans `sourcing_urls`

Une seule opération `INSERT` (via outil insert, pas migration) avec les URLs **exactement telles que validées** par toi.

| # | Plateforme | URL | Platform tag |
|---|---|---|---|
| 1 | Maximilien (IDF) | `https://marches.maximilien.fr/?page=entreprise.EntrepriseAdvancedSearch&AllCons` | `atexo` |
| 2 | APProch (préavis État) | `https://projets-achats.marches-publics.gouv.fr/` | `place` |
| 3 | Ternum BFC | `https://marches.ternum-bfc.fr/?page=entreprise.EntrepriseAdvancedSearch&AllCons` | `atexo` |
| 4 | Grand Est | `https://marchespublics.grandest.fr/avis/index.cfm?fuseaction=pub.affResultats` | `mpi` (moteur ColdFusion `marches-publics.info`) |
| 5 | Alsace MP | `https://plateforme.alsacemarchespublics.eu/?page=Entreprise.EntrepriseAdvancedSearch&searchAnnCons&keyWord=&categorie=0&localisations=` | `atexo` |
| 6 | AMP Métropole | `https://marchespublics.ampmetropole.fr/?page=Entreprise.EntrepriseAdvancedSearch&AllCons` | `atexo` |
| 7 | Nantes Métropole | `https://marchespublics.nantesmetropole.fr/?page=Entreprise.EntrepriseAdvancedSearch&AllCons` | `atexo` |
| 8 | AURA | `https://marchespublics.auvergnerhonealpes.eu/sdm/ent2/gen/rechercheCsl.action?tp=1776784247743` | `safetender` (moteur SDM/Local-trust) |
| 9 | Pays de la Loire | `https://marchespublics.paysdelaloire.fr/?page=Entreprise.EntrepriseAdvancedSearch&AllCons` | `atexo` |
| 10 | Haute-Garonne | `https://haute-garonne.marches-publics.info/avis/index.cfm?fuseaction=pub.affResultats&IDs=4150` | `mpi` |

Chaque ligne sera insérée avec :
- `frequency_hours = 6`
- `is_active = true`
- `parser_type = 'auto'`
- `display_name` = nom lisible (ex. "Maximilien (Île-de-France)")

### 2. Améliorer la détection de plateforme

Mettre à jour `detectPlatformFromUrl()` dans `supabase/functions/_shared/normalize.ts` pour reconnaître les hostnames de tes 10 URLs :

- `maximilien` → `atexo`
- `projets-achats.marches-publics.gouv.fr` → `place`
- `ternum-bfc` → `atexo`
- `marchespublics.grandest.fr` → `mpi`
- `alsacemarchespublics.eu` → `atexo`
- `ampmetropole` → `atexo`
- `nantesmetropole` → `atexo`
- `auvergnerhonealpes` (avec `/sdm/`) → `safetender`
- `paysdelaloire` → `atexo`
- `haute-garonne.marches-publics.info` → déjà `mpi` (existant)

### 3. Affiner le prompt Firecrawl

Dans `supabase/functions/scrape-list/index.ts`, le prompt sera enrichi pour mieux guider l'extraction sur ces 3 moteurs distincts (Atexo / MPI ColdFusion / SDM Local-trust) :

> "Cette page est un portail de marchés publics. Extrais TOUTES les consultations affichées dans le tableau/liste. Chaque ligne contient typiquement : référence, intitulé, acheteur, date limite de remise des offres, type de procédure. Résous les liens relatifs (`?page=...&id=...`) en URLs absolues à partir de l'URL source. Ignore les filtres, la pagination et les en-têtes."

### 4. Dry-run de validation sur 3 URLs

Après insertion + déploiement, lancement automatique de `scrape-list` en mode `dry_run: true` sur :
- Maximilien (Atexo représentatif)
- Grand Est (MPI ColdFusion représentatif)
- AURA (SDM Local-trust représentatif)

Je te renvoie un rapport :
```
Plateforme           Items extraits   Échantillon (titre + ref)
Maximilien           ?                ...
Grand Est            ?                ...
AURA                 ?                ...
```

## Ce qui n'est PAS fait dans cette étape

- Pas de migration SQL (les 10 URLs = données, pas schéma)
- Pas de modification de l'UI `/sourcing` (déjà en place)
- Pas de cron supplémentaire (le cron 6h existant prendra le relais)

## Après ce ticket

Tu pourras depuis `/sourcing` :
- Voir les 10 URLs listées
- Désactiver celles qui ne donnent rien
- Lancer un run manuel par URL
- Consulter les logs détaillés en bas de page

Si une plateforme renvoie 0 résultats au dry-run, je te le signale et on ajuste (URL alternative, prompt spécifique, ou exclusion).

