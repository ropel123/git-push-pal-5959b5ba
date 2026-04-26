## Pourquoi il reste des mauvais titres

Diagnostic en base sur ~1051 fiches Atexo :
- **855** ont un titre correct ✅
- **154** ont le titre **"Accéder à la consultation"** (le scraper a pris le texte du lien d'action de la liste comme titre)
- **42** ont le titre **"Consultation {id}"** (placeholder différent de "Consultation Atexo {id}", donc ignoré par le backfill v3.6)

Exemples concrets :
- `marches.local-trust.com/.../534253` → titre = "Accéder à la consultation", buyer = "Neotoa"
- `mpe.mairie-marseille.fr/.../524468` → titre = "Consultation 4", buyer = "Mairie de Marseille"
- `marches-publics.regionreunion.com/.../506296` → titre = "Consultation 506296", buyer = "Organisme Public"

**Cause racine** : le filtre du `atexo-backfill` ne cible QUE les titres `Consultation Atexo%`. Les deux autres familles de placeholders passent à travers.

## Plan v3.7 — Élargir la rétro-enrichissement

### 1. Élargir le filtre de `atexo-backfill`
Dans `supabase/functions/atexo-backfill/index.ts`, remplacer le filtre actuel par une condition couvrant **toutes** les fiches Atexo dont les métadonnées sont incomplètes :

```sql
source LIKE 'scrape:atexo%' AND (
  title ILIKE 'Consultation Atexo%'
  OR title ILIKE 'Accéder%' OR title ILIKE 'Acceder%'
  OR title ~* '^Consultation [0-9]+$'
  OR title IS NULL OR title = ''
  OR buyer_name IN ('Organisme Public', 'Non spécifié', '')
  OR buyer_name IS NULL
  OR deadline IS NULL
)
```

### 2. Corriger la source du bug côté scrape-list
Dans le pipeline de scraping Atexo (probablement `atexoExecutor.ts` ou `normalize.ts`), quand le détail page **ne renvoie aucun champ** (`_matched_fields === 0`), il faut **rejeter** le titre fallback "Accéder à la consultation" / "Consultation {n}" et utiliser à la place :
- titre temporaire : `Consultation Atexo {id}` (uniforme, attrapé par le backfill)
- buyer_name : laisser `null` si non extrait (au lieu d'écrire l'acronyme `cg-55`, `cma`, `a2z`)

### 3. Améliorer la robustesse du détail parser
Pour les hosts qui ont échoué (`marches.local-trust.com`, `mpe.mairie-marseille.fr`, `regionreunion.com`), ajouter :
- Un retry avec une seconde tentative de seeding cookie (GET du host root + GET de la page recherche avant le détail)
- Des variantes supplémentaires de labels (certaines skins Atexo utilisent "Intitulé du marché", "Nom du pouvoir adjudicateur", "Fin de la consultation")
- Un fallback sur le `<title>` HTML de la page si aucun label ne matche (souvent contient l'intitulé)

### 4. Bouton UI : pas de changement
Le bouton "Rétro-enrichir Atexo" existant dans `src/pages/Sourcing.tsx` continuera à fonctionner — il itèrera désormais sur **les 3 familles** de placeholders (~196 fiches restantes après la 1ʳᵉ vague + tout ce que le backfill v3.6 n'avait pas pu enrichir).

## Détails techniques

**Fichiers modifiés** :
- `supabase/functions/atexo-backfill/index.ts` → élargir le filtre `.or(...)` Supabase
- `supabase/functions/_shared/atexoDetailParser.ts` → ajouter variantes de labels + fallback `<title>`
- `supabase/functions/_shared/atexoExecutor.ts` → uniformiser le titre placeholder quand le détail échoue, ne pas écrire l'acronyme comme buyer
- (optionnel) script SQL one-shot pour normaliser tous les titres "Accéder à la consultation" et "Consultation {n}" en "Consultation Atexo {id}" avant que le backfill tourne, afin d'avoir des logs propres

**Telemetry** : le log `atexo_backfill` continuera à reporter `items_updated` / `remaining_after`, mais avec le nouveau filtre la queue initiale sera ~196 + reste du précédent batch.

## Ce que tu auras à faire après le déploiement

1. Aller sur `/sourcing`
2. Cliquer sur **"Rétro-enrichir Atexo"** → la boucle traitera automatiquement les 196 fiches mal nommées en 5–7 minutes
3. Recharger `/tenders` : plus aucun titre "Accéder à la consultation" ou "Consultation {n}"

Les **futurs** scrapings n'auront plus ce problème grâce au correctif #2 (placeholder uniforme).