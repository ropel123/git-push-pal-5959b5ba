

# Audit complete des appels d'offres — Resultats et plan de correction

## Etat actuel de la base (518 AO)

```text
Source  | Famille       | Total | Description | Adresse | Conditions | Criteres
--------|---------------|-------|-------------|---------|------------|--------
boamp   | FNSimple      |  175  |  137 (78%)  | 174     |  155       |  175 ✓
boamp   | MAPA          |   32  |   28 (88%)  |  32     |   11 ✗     |   10 ✗
boamp   | DIRECTIVE-24  |  175  |    0 (0%)   |   0     |    0       |    0 ✗✗
boamp   | DIRECTIVE-25  |   10  |    0 (0%)   |   0     |    0       |    0 ✗✗
boamp   | DIRECTIVE-23  |    7  |    0 (0%)   |   0     |    0       |    0 ✗✗
boamp   | DSP           |    1  |    0        |   1     |    0       |    0
ted     | —             |  100  |   99 (99%)  |   0     |    0       |    0 ✗✗
legacy  | BOAMP/JOUE    |   18  |    0        |   0     |    0       |    0
```

## 3 problemes majeurs identifies

### 1. MAPA : conditions et criteres manquants (32 AO)

**Bug** : dans `parseBoampDonnees`, la condition `!isEmptyObject(justifications)` a la ligne 160 est `false` quand toutes les valeurs sont vides → le bloc entier est saute, y compris le fallback ligne 190 qui devrait lister les types de documents requis. Le fallback est a l'interieur du bloc qu'on saute — il est inatteignable.

Meme probleme pour `criteres` : `{"critereCDC":""}` est detecte comme vide par `textify`, donc `award_criteria` = null. Mais la cle `critereCDC` signifie "criteres dans le cahier des charges" — c'est une info utile.

### 2. DIRECTIVE-24/25/23 : 192 AO completement vides (37% du total)

Ces notices utilisent le format **eForms** (standard EU). La structure JSON est radicalement differente :
```text
EFORMS.ContractNotice
├── efac:Organizations → SIRET, email, tel, adresse
├── cac:ProcurementProject → titre, description, CPV
├── cac:ProcurementProjectLot[] → lots
└── cac:TenderingTerms → conditions
```
Le parser ne gere pas du tout ce format.

### 3. TED : 100 AO sans criteres, conditions, ni adresse

Le scraper TED ne demande pas les champs `award-criteria`, `selection-criteria`, `buyer-street-address`, `buyer-email`, `buyer-phone` a l'API. Et il ne pagine pas (seulement page 1 = 100 resultats).

### Bonus : `region` stocke la famille (MAPA, FNSimple...) au lieu de la region geographique

## Plan de correction

### Fichier 1 : `supabase/functions/scrape-boamp/index.ts`

**Fix MAPA** :
- Sortir le fallback justifications du bloc `!isEmptyObject` — toujours verifier les cles connues et lister les documents requis meme quand les valeurs sont vides
- Si la cle `critereCDC` existe dans `criteres`, generer "Criteres definis dans le cahier des charges (reglement de consultation)"

**Ajouter `parseEformsDonnees()`** pour DIRECTIVE-24/25/23 :
- Detecter la cle `EFORMS` et naviguer dans `ContractNotice`
- Mapper : `cac:ProcurementProject.cbc:Name` → titre, `efac:Organization` → contact/SIRET, `cac:ProcurementProjectLot` → lots, etc.

**Fix region** :
- Ne plus utiliser `r.perimetre` (qui contient la famille)
- Deduire la region du NUTS code ou du departement

### Fichier 2 : `supabase/functions/scrape-ted/index.ts`

- Ajouter les champs dans `searchPayload.fields` : `award-criteria`, `selection-criteria`, `buyer-postal-code`, `buyer-street-address`, `buyer-email`, `buyer-phone`
- Mapper ces champs dans `normalizeTedToTender`
- Ajouter la pagination : boucler sur les pages tant que `notices.length === limit`

### Nettoyage

- Supprimer les 18 AO legacy (source `BOAMP`/`JOUE` majuscule) sans donnees

### Post-deploiement

- Re-deployer et re-executer les deux scrapers pour backfill les ~500 AO

