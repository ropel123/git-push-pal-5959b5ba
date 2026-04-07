

# Filtrage intelligent des appels d'offres par profil entreprise

## Problème

Actuellement, la page Tenders affiche TOUS les appels d'offres sans distinction. Pour une entreprise de BTP en Île-de-France, elle voit aussi les marchés informatiques en Bretagne — inutile et bruyant.

## Solution

Appliquer automatiquement les filtres du profil (secteurs, régions, mots-clés) au chargement de la page, avec un toggle "Voir tous les AO" pour désactiver le filtre si besoin.

## Fonctionnement

### 1. Filtre par défaut au chargement

Quand le profil est chargé, on applique automatiquement :
- **Régions** du profil → filtre `region` (multi-régions avec `.in()`)
- **Mots-clés** du profil → recherche textuelle combinée sur `title`, `object`, `buyer_name`
- **Secteurs** → matching sur les CPV codes ou le texte de l'AO

Un état `smartFilter: boolean` (défaut `true`) contrôle si le filtrage intelligent est actif.

### 2. Toggle "Filtrage intelligent"

Un switch bien visible en haut de page : "Appels d'offres pour mon entreprise" (activé par défaut). Quand désactivé, on retrouve tous les AO comme avant.

### 3. Tri par score

Quand le filtrage intelligent est actif, les résultats sont triés par score de pertinence (descendant) plutôt que par date de publication, pour montrer les plus pertinents en premier.

### 4. Indicateur visuel

Un badge ou bandeau indiquant "Filtré selon votre profil (3 régions, 5 mots-clés)" pour que l'utilisateur comprenne pourquoi il voit ces résultats.

## Changements techniques

**Fichier** : `src/pages/Tenders.tsx`

- Ajouter état `smartFilter` (boolean, défaut `true`)
- Attendre que `profile` soit chargé avant le premier fetch
- Dans `fetchTenders` : si `smartFilter` est actif ET que le profil a des données :
  - Filtrer par régions du profil avec `.in("region", profile.regions)`
  - Construire un `.or()` avec les mots-clés du profil pour matcher `title.ilike` / `object.ilike`
  - Ces filtres s'ajoutent aux filtres manuels (pas de remplacement)
- Ajouter un Switch "Filtrage intelligent" dans le header
- Ajouter un petit texte explicatif sous le titre indiquant les critères actifs
- Trier côté client par score quand `smartFilter` est actif (le scoring est déjà calculé)

**Aucune migration DB nécessaire** — tout se fait côté requête client.

## Résultat attendu

- Par défaut, l'utilisateur voit uniquement les AO qui correspondent à son profil
- Il peut désactiver le filtre en un clic pour voir tout
- Les filtres manuels (région, statut, procédure) restent utilisables en complément
- Plus le profil est renseigné, plus le filtrage est précis

