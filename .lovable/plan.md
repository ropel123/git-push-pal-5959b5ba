

# Audit BOAMP complet — Tous les problemes identifies et corrections

## Etat actuel (400 AO BOAMP)

```text
Champ                  | Rempli | %    | Probleme
-----------------------|--------|------|------------------------------------------
description            | 378    | 95%  | OK
buyer_address          | 322    | 81%  | OK
buyer_contact          | 322    | 81%  | OK
region                 | 289    | 72%  | "20A"/"20B" manquants (Corse)
participation_cond.    | 182    | 46%  | eForms: jamais extrait du lot
award_criteria         | 110    | 28%  | eForms: 0%. FNSimple: 50%
estimated_amount       |  83    | 21%  | valeurEstimee ignoree, regex seul
lots (non-vide)        | 191    | 48%  | FNSimple: lots dans initial.lots, pas natureMarche
```

## 5 bugs identifies

### 1. eForms (192 AO) : 0% criteres, 0% conditions

Le parser cherche `cac:AwardingTerms` au niveau racine du notice, mais dans eForms les criteres/conditions sont dans `cac:ProcurementProjectLot.cac:TenderingTerms` — un niveau plus profond. Et quand la valeur est `selection-criteria-source: epo-procurement-document`, ca signifie "criteres dans les documents de consultation" — on devrait stocker ce texte au lieu de null.

Egalement, les `cac:ContractExecutionRequirement` (facturation electronique, catalogue, etc.) ne sont pas extraites comme conditions.

### 2. FNSimple : `estimated_amount` ignore `valeurEstimee`

Le champ `natureMarche.valeurEstimee.valeur` contient le montant estimatif (ex: "250000.0") mais le parser ne fait qu'un regex sur le texte de description. Resultat : 79% des montants sont null.

### 3. FNSimple : lots dans `initial.lots.lot[]`, pas `natureMarche.lotsMarche`

Le parser cherche `natureMarche.lotsMarche` (qui est juste un booleen `{oui:""}`) au lieu de `initial.lots.lot[]` qui contient les vrais lots avec description, CPV et montant par lot.

### 4. FNSimple : criteres souvent absents = normal

Pour ~50% des MAPA/adaptees, les criteres ne sont pas dans le JSON — c'est le reglement de consultation (RC) qui les contient. Quand `procedure.attributionSansNegociation` existe ou qu'il n'y a pas de `criteresAttrib`, on devrait stocker "Criteres definis dans les documents de la consultation" au lieu de null.

### 5. Region : codes "20A"/"20B" manquants

L'API BOAMP utilise "20A"/"20B" pour la Corse mais `DEPT_TO_REGION` n'a que "2A"/"2B"/"20".

## Corrections

### `supabase/functions/scrape-boamp/index.ts`

**Fix 1 — eForms criteres et conditions** : dans `parseEformsDonnees`, chercher aussi dans `cac:ProcurementProjectLot` :
- Extraire `cac:AwardingTerms` au niveau lot
- Detecter `selection-criteria-source: epo-procurement-document` → "Criteres definis dans les documents de la consultation"
- Extraire `cac:ContractExecutionRequirement` comme conditions (e-invoicing, etc.)
- Extraire `cac:AppealTerms.cac:PresentationPeriod.cbc:Description` comme additional_info

**Fix 2 — Montant estimatif** : dans `parseBoampDonnees`, extraire `natureMarche.valeurEstimee.valeur` AVANT le fallback regex :
```
const directAmount = dig(natureMarche, "valeurEstimee", "valeur");
if (directAmount) estimatedAmount = parseFloat(String(directAmount));
```
Aussi extraire les montants par lot depuis `initial.lots.lot[].estimationValeur.valeur`.

**Fix 3 — Lots FNSimple** : chercher dans `initial.lots.lot[]` (ou `rectif.lots.lot[]`) au lieu de `natureMarche.lotsMarche` :
```
const lotsData = initial?.lots?.lot || rectif?.lots?.lot || [];
```

**Fix 4 — Criteres fallback** : apres la ligne 446, ajouter :
```
if (!awardCriteria) {
  awardCriteria = textify(natureMarche.criteresAttrib) || null;
}
if (!awardCriteria && procedure && typeof procedure === "object") {
  awardCriteria = "Critères définis dans les documents de la consultation";
}
```

**Fix 5 — Region Corse** : ajouter `"20A": "Corse", "20B": "Corse"` dans DEPT_TO_REGION.

### Post-deploiement
- Redeployer et re-executer le scraper pour corriger les 400 AO existantes

### Resultats attendus

```text
Champ              | Avant | Apres (estime)
-------------------|-------|---------------
award_criteria     |  28%  | ~90%+
participation_cond |  46%  | ~70%+
estimated_amount   |  21%  | ~60%+
lots               |  48%  | ~70%+
region             |  72%  | ~75%+
```

