## Pourquoi tu vois encore ces titres

Diagnostic sur les 3 AO de la capture (`937132`, `931590`, `935923`) :

- Tous viennent de `https://marches.maximilien.fr/entreprise/consultation/{id}` — un host qui **n'avait jamais été enrichi** auparavant (les runs précédents ne touchaient que `departement86` et `regionreunion`).
- Leur `enriched_data` est `NULL` → 0 tentative de backfill, pas de flag `skip`.
- Ils sont bien dans la queue, mais le backfill ne tourne **pas tout seul** : pas de cron, déclenché uniquement par le bouton "Rétro-enrichir Atexo" sur `/sourcing`.
- Dernier run : 26/04 10:14. Depuis, **223 nouveaux placeholders** ont été insérés (dont 171 sur `maximilien.fr`), créés par le scraper de listing entre le 26/04 et le 28/04 12:08.

**Cause racine** : l'ingestion (`atexoExecutor.ts`) écrit délibérément un titre placeholder `Consultation Atexo {id}` quand l'enrichissement détail n'a pas eu le temps de tourner, ou n'est pas tenté du tout. Le rattrapage est laissé à un backfill 100 % manuel → tout ce qui arrive entre deux clics reste cassé en UI.

## Plan v3.9 — éliminer le placeholder à la source

### 1. Cron horaire sur `atexo-backfill`
Ajouter un cron pg_cron qui appelle l'edge function toutes les heures (batch de 80) tant qu'il reste des placeholders. Plus jamais besoin de cliquer le bouton.

### 2. Forcer l'enrichissement détail à l'ingestion pour TOUS les hosts Atexo
Dans `_shared/atexoExecutor.ts` (bloc step 4, ligne ~310) : retirer la condition `stats.engine === "prado_event_chain"`. Aujourd'hui, si l'engine est autre chose (ex. fallback Firecrawl ou ingestion directe `single_page` sur `maximilien.fr`), **aucun appel détail n'est lancé** → tous les items partent en placeholder. On veut enrichir dès que `allIds.size > 0`, peu importe l'engine.

### 3. Bornes de robustesse
- Augmenter `MAX_ATTEMPTS` de 3 → 5 dans `atexo-backfill` pour les hosts lents.
- Loguer le `host` dans `scrape_logs.metadata` du backfill pour identifier les nouveaux domaines (déjà fait, vérifier).

### 4. Cleanup ponctuel des 223 placeholders existants
Lancer manuellement `atexo-backfill` 3-4 fois (batch=100) pour rattraper le retard, puis vérifier `remaining`. Les irrécupérables (404 / archives) seront marqués `backfill_skip=true` automatiquement après 5 tentatives.

### 5. UI : masquer ou marquer les placeholders restants
Sur `/tenders` (`src/pages/Tenders.tsx`), filtrer ou taguer visuellement (badge "En cours d'enrichissement") les lignes dont le titre matche `^Consultation Atexo \d+$`, pour qu'ils ne ressemblent plus à des AO normaux pendant la fenêtre cron (≤1 h).

## Détails techniques

**Fichiers modifiés** :
- `supabase/functions/_shared/atexoExecutor.ts` — relâcher la garde `engine === "prado_event_chain"` du step 4
- `supabase/functions/atexo-backfill/index.ts` — `MAX_ATTEMPTS = 5`
- Migration SQL — `cron.schedule('atexo-backfill-hourly', '0 * * * *', ...)` invoquant l'edge function via `net.http_post` avec batch=80
- `src/pages/Tenders.tsx` — badge "Enrichissement en cours" si `/^Consultation Atexo \d+$/.test(title)`

**Sécurité** : le cron passe le service role key via `Authorization` header (jamais exposé client).

**Validation** : après déploiement, vérifier sur `/tenders` que `937132`, `931590`, `935923` affichent leur vrai titre dans l'heure qui suit.
