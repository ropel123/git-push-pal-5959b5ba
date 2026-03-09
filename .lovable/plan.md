

# Plan : Enrichir le scraper TED pour remplir les fiches AO

## Probleme
Les AO importees depuis TED n'ont aucun detail : pas de titre, pas d'acheteur, pas de montant, pas de deadline, pas de CPV. Le scraper actuel ne demande que le champ `sme-part` a l'API TED, donc les notices arrivent vides.

## Solution
Modifier `supabase/functions/scrape-ted/index.ts` pour demander les bons champs a l'API TED v3 et les mapper correctement.

### Champs a demander dans `fields`
```
["notice-title", "buyer-name", "deadline-receipt-request", 
 "estimated-value", "cpv-code", "procedure-type", 
 "description-lot", "publication-date"]
```

### Mapping dans `normalizeTedToTender`
- `notice-title` → `title` + `object`
- `buyer-name` → `buyer_name`
- `deadline-receipt-request` → `deadline`
- `estimated-value` → `estimated_amount`
- `cpv-code` → `cpv_codes`
- `procedure-type` → `procedure_type`
- `description-lot` → `lots`
- `publication-date` → `publication_date`

### Fichier modifie
- `supabase/functions/scrape-ted/index.ts` : changer `fields`, refaire le mapping, deployer

### Post-deploiement
- Re-executer la fonction pour mettre a jour les 118 notices TED existantes avec les vrais champs

