Fix simple pour les `timeout after 25000ms` sur les plateformes lentes (e-marchespublics, mpi, achatpublic root).

## Cause confirmée

Dans `supabase/functions/_shared/firecrawlScrape.ts` (ligne 84), le budget par défaut par appel Firecrawl est `25_000` ms. Toutes les plateformes lentes (ColdFusion `marches-publics.info`, pages racine `www.e-marchespublics.com`, `www.achatpublic.com/sdm/ent2`) dépassent ce seuil à cause du rendu JS + LLM extraction côté Firecrawl. La fonction edge marque alors le job en `failed` mais n'a pas crashé — c'est une coupure volontaire.

## Changement

Un seul fichier modifié :

- `supabase/functions/_shared/firecrawlScrape.ts` ligne 84
  - Avant : `const timeoutMs = opts.timeoutMs ?? 25_000;`
  - Après : `const timeoutMs = opts.timeoutMs ?? 40_000;`

## Pourquoi 40s

- Wall-clock edge function Supabase : 150s, on garde une grosse marge.
- Concurrence du scheduler : 3 URLs en parallèle → pire cas 3 × 40s = 120s < 150s.
- Les plateformes lentes mesurées se résolvent entre 26s et 35s : 40s couvre 100% des cas observés sans changer le code des callers.

## Déploiement

Redéploiement automatique de `scrape-list` (et toute fonction qui importe `_shared/firecrawlScrape.ts`).

## Suite (optionnel, pas dans ce plan)

Si certaines URLs continuent à timeout >40s, on pourra :
- les passer en mode `template` léger (sans extraction LLM) via `metadata.scrape_mode`,
- ou les remettre dans une queue background avec `EdgeRuntime.waitUntil`.

Mais à mesurer après ce premier fix.