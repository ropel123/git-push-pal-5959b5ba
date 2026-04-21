
# Fix du lien "Voir l'avis original"

## Le problème

Sur la fiche AO (`/tenders/631293a3...`), le lien "Voir l'avis original" t'envoie sur la page de recherche générique de Ternum BFC (`?page=Entreprise.EntrepriseAdvancedSearch&AllCons`) au lieu de la fiche de la consultation.

## Cause

Dans `upsert-tenders/index.ts` (ligne 48), on stocke dans `source_url` **l'URL de la page de listing** scrapée (celle configurée dans `sourcing_urls`) — pas le lien direct vers chaque AO.

Pour le tender que tu regardes, la base contient :
- `source_url` = `https://marches.ternum-bfc.fr/?page=entreprise.EntrepriseAdvancedSearch&AllCons` ← page de recherche (utilisé par "Voir l'avis original")
- `dce_url` = `https://www.marches-publics.gouv.fr/app.php/entreprise/consultation/2734339?orgAcronyme=b4n` ← le bon lien direct

Bizarre ici : le `dce_url` pointe sur PLACE alors que la source était Ternum. C'est l'extraction Firecrawl qui a renvoyé un lien absolu mal résolu (PLACE au lieu de Ternum). À corriger aussi.

## Correctif

### 1. Front — `src/pages/TenderDetail.tsx` (lignes 199-203)

Faire pointer "Voir l'avis original" en priorité vers `dce_url` (le lien fiche), et ne tomber sur `source_url` que si `dce_url` est vide.

```tsx
{(tender.dce_url || tender.source_url) && (
  <a href={tender.dce_url || tender.source_url} target="_blank" ...>
    <ExternalLink className="h-3 w-3" /> Voir l'avis original
  </a>
)}
```

Effet immédiat : pour ton AO, le bouton ouvrira la fiche PLACE (`/consultation/2734339`).

### 2. Backend — `supabase/functions/upsert-tenders/index.ts` (ligne 48)

Stocker dans `source_url` **le lien fiche extrait** (`item.dce_url`) quand il est valide, et garder l'URL de listing en fallback dans `enriched_data.listing_url`.

```ts
const item_link = item.dce_url && /^https?:\/\//.test(item.dce_url) ? item.dce_url : null;
// ...
source_url: item_link || item._source_url,
enriched_data: {
  scraped_at: new Date().toISOString(),
  platform: item._platform,
  listing_url: item._source_url,
  raw: item,
},
```

### 3. Backend — `supabase/functions/scrape-list/index.ts` (prompt Firecrawl, ligne 51)

Renforcer l'instruction pour que Firecrawl résolve les liens **relatifs au domaine de la page scrapée** et n'invente pas un lien vers un autre portail (PLACE, etc.) :

> "L'URL ABSOLUE doit avoir le MÊME hostname que la page d'origine. Les liens relatifs (`?page=...&id=...`, `/consultation/123`) doivent être résolus contre l'URL de base. Si tu vois un lien vers un autre domaine (boamp, marches-publics.gouv.fr) qui n'est pas dans le HTML, NE l'invente PAS — laisse `dce_url` vide."

Et côté code, on ajoute une garde après l'extraction : si `dce_url` n'a pas le même hostname que `_source_url` ET ne provient pas d'une plateforme connue (BOAMP/PLACE/TED en cross-publication), on l'ignore.

### 4. Backfill des AO existants (optionnel)

Le tender `631293a3` et probablement d'autres ont déjà le mauvais `source_url` en base. Une migration peut écraser `source_url := dce_url` pour les lignes où `source_url` contient `EntrepriseAdvancedSearch` ou `AllCons` (page de recherche générique).

## Résumé des fichiers touchés

- `src/pages/TenderDetail.tsx` — fallback `dce_url` → `source_url`
- `supabase/functions/upsert-tenders/index.ts` — source_url = lien fiche
- `supabase/functions/scrape-list/index.ts` — prompt + garde same-hostname
- (optionnel) migration SQL de backfill

Le fix #1 te débloque tout de suite sur le tender actuel. Les fix #2/#3 évitent que ça se reproduise sur les futurs scrapes.
