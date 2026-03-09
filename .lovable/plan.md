

# Plan : Corriger le parsing des champs vides et le rendu des donnees MAPA

## Probleme

L'AO 26-23770 a bien des donnees extraites (description, contact, adresse), mais 3 problemes :

1. **`participation_conditions`** stocke un JSON brut avec toutes les valeurs vides : `{"redressementJudiciaire":"","article2141":"",…}` — le bloc `justifications` MAPA contient les cles des documents requis mais avec des valeurs vides. `textify()` serialise ca en JSON au lieu de l'ignorer.

2. **`award_criteria`** stocke `{"critereCDC":""}` — meme probleme, `textify(criteres)` retourne le JSON d'un objet avec des valeurs vides.

3. **`cpv_codes`** contient `[57, 74, 372]` — ce sont les `descripteur_code` BOAMP (codes departementaux/descripteurs), PAS des codes CPV. Le fallback `r.descripteur_code` injecte des mauvaises valeurs.

## Solution

### 1. `scrape-boamp/index.ts` — Corriger `textify` et le parsing

- **Nouvelle fonction `isEmptyObject`** : detecte les objets dont toutes les valeurs sont des chaines vides, et retourne `null` au lieu de serialiser en JSON
- **`textify` ameliore** : avant de `JSON.stringify`, verifier si l'objet est "vide" (toutes valeurs = `""`) → retourner `null`
- **Justifications MAPA** : mapper les cles vers des labels francais lisibles (`redressementJudiciaire` → "Redressement judiciaire", `article2141` → "Interdictions de soumissionner", etc.) et ne garder que celles avec une valeur non-vide
- **CPV fallback** : valider que les codes du fallback `descripteur_code` ressemblent a des CPV (8 chiffres, commencant par 0-9) avant de les utiliser. Sinon → `[]`

### 2. `TenderDetail.tsx` — Robustesse affichage

- Pour `award_criteria` et `participation_conditions` : tenter un `JSON.parse`, et si c'est un objet avec toutes les valeurs vides, ne pas afficher la section
- Eviter d'afficher `{"critereCDC":""}` en texte brut

### Fichiers modifies
- `supabase/functions/scrape-boamp/index.ts` : fix textify + CPV fallback
- `src/pages/TenderDetail.tsx` : robustesse rendu JSON

### Post-deploiement
- Re-executer le scraper pour corriger les ~400 AO existantes

