

# Plan : Corriger le parsing des rectificatifs et les donnees brutes

## Probleme

L'AO **26-24151** est un **avis rectificatif**. Le scraper ne lit que `root.initial.*` mais les rectificatifs stockent les donnees sous `root.rectificatif.*` (description, CPV 45316213, criteres "enonce dans le RC", deadline corrigee 20/03/2026). Tout est perdu.

En plus, 3 bugs de normalisation persistent dans les donnees stockees :

```text
Champ              | Valeur stockee      | Attendu
-------------------|---------------------|------------------
contract_type      | ["TRAVAUX"]         | Travaux
award_criteria     | {}                  | (null / masque)
additional_info    | {}                  | (null / masque)
buyer_contact      | {"ville":"..."}     | + email, tel manquants
```

## Causes

1. **`parseBoampDonnees`** : `root.initial` est vide pour les rectificatifs → toutes les variables restent null. Le parser ne cherche jamais dans `root.rectificatif`.

2. **`isEmptyObject({})`** retourne `false` car `values.length > 0` echoue sur un objet sans cles → `textify({})` retourne `"{}"` au lieu de `null`.

3. **`contract_type`** : `r.type_marche` est un array brut (`["TRAVAUX"]`), jamais normalise — stocke tel quel.

## Corrections

### `scrape-boamp/index.ts`

**Fix rectificatifs** (lignes 347-360) : apres avoir extrait `initial`, si les champs cles sont vides, chercher dans `root.rectificatif` :
- `rectificatif.natureMarche` → titre, description, CPV, lieu
- `rectificatif.criteres` → award_criteria
- `rectificatif.infosRectif` → additional_info (ex: "Au lieu de 13/03 lire 20/03")

**Fix `isEmptyObject`** (ligne 25) : retourner `true` pour `{}` (0 cles) :
```
return values.length === 0 || values.every(v => ...)
```

**Fix `contract_type`** (ligne 569) : normaliser `r.type_marche` :
```
const rawType = r.type_marche;
const contractType = rich.contractType 
  || (Array.isArray(rawType) ? rawType[0] : rawType) 
  || null;
```

### `TenderDetail.tsx`

**Fix `contract_type` affichage** (ligne 157) : nettoyer les crochets/guillemets :
```
{(tender.contract_type || "").replace(/[\[\]"]/g, "")}
```

**Fix `isDisplayableText`** (ligne 127) : aussi rejeter `"{}"` et `"[]"` explicitement.

### Fichiers modifies
- `supabase/functions/scrape-boamp/index.ts` : rectificatifs + isEmptyObject + contract_type
- `src/pages/TenderDetail.tsx` : nettoyage affichage

### Post-deploiement
- Re-executer le scraper pour corriger les ~500 AO existantes

