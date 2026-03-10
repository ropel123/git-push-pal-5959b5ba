

# Extraire et afficher les URLs DCE comme liens cliquables

## Constat

Les URLs des documents de consultation (DCE) existent dans les donnees mais sont enterrees dans le champ texte `additional_info` :
```
Documents : https://marchespublics-aude.safetender.com
Dépôt des offres : https://marchespublics-aude.safetender
```

Elles ne sont pas cliquables et l'utilisateur ne peut pas y acceder facilement.

## Corrections

### 1. Migration DB : ajouter `dce_url` et `submission_url`
```sql
ALTER TABLE tenders ADD COLUMN dce_url text;
ALTER TABLE tenders ADD COLUMN submission_url text;
```

### 2. Scraper TED (`scrape-ted/index.ts`)
Extraire `document-url-lot` dans `dce_url` et `submission-url-lot` dans `submission_url` au lieu de les noyer dans `additional_info`.

### 3. Scraper BOAMP (`scrape-boamp/index.ts`)
Extraire `urlDocConsul` (ou fallback `urlProfilAch`) dans `dce_url` au lieu de le stocker uniquement dans `buyer_contact.url`.

### 4. Page TenderDetail (`src/pages/TenderDetail.tsx`)
Ajouter deux boutons/liens bien visibles dans le header :
- "Acceder au DCE" (lien vers `dce_url`) avec icone `FileDown`
- "Deposer une offre" (lien vers `submission_url`) avec icone `ExternalLink`

Affichage conditionnel : visibles uniquement quand les URLs sont renseignees.

### Fichiers modifies
- Migration SQL (2 nouvelles colonnes)
- `supabase/functions/scrape-ted/index.ts`
- `supabase/functions/scrape-boamp/index.ts`
- `src/pages/TenderDetail.tsx`

