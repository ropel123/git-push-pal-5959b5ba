# Refactoring stratégique — Plan en 4 chantiers

Objectif : exécuter les 4 refactorings identifiés à l'audit dans un ordre qui minimise les conflits (backend d'abord, puis types, puis UI). Estimation totale : 7-11 jours de travail consolidé en livraisons incrémentales.

## Ordre d'exécution

```text
Chantier 1 (1j)  →  Chantier 2 (1-2j)  →  Chantier 3 (2-3j)  →  Chantier 4 (3-5j)
SQL + Upsert        AI Gateway          TS strict             TanStack Query
```

Chaque chantier est livré indépendamment, testable, et peut être validé avant de passer au suivant.

---

## Chantier 1 — Upsert batch + index SQL (1j)

**Objectif** : passer de 2 round-trips par item à 1 seul appel batch, et accélérer les requêtes Dashboard/Tenders.

- **Migration SQL** : index sur `tenders(status)`, `tenders(region)`, `tenders(deadline)`, `tenders(source, reference)` (composite pour upsert), `pipeline_items(user_id, stage)`.
- **Contrainte unique** sur `tenders(source, reference)` si absente (requise pour `onConflict`).
- **Refactor `upsert-tenders/index.ts`** :
  - Normaliser tous les items en mémoire
  - Un seul `supabase.from('tenders').upsert(rows, { onConflict: 'source,reference', ignoreDuplicates: false })`
  - Pour le merge `enriched_data` : pré-fetch en 1 query `IN (...)` puis merge côté JS avant upsert
- **Bénéfice mesuré attendu** : 10-50× sur les gros batches (>100 items), élimine les timeouts edge function.

---

## Chantier 2 — AI Gateway centralisé (1-2j)

**Objectif** : un seul point d'entrée pour tous les appels IA, avec retry/fallback unifié.

- **Créer `supabase/functions/_shared/aiGateway.ts`** exposant :
  - `callAI({ provider: 'claude' | 'gemini', messages, tools?, jsonSchema?, maxTokens })`
  - Fallback automatique Claude → Gemini sur 429/402/timeout
  - Retry exponential backoff (3 tentatives)
  - Logging unifié (model, tokens, latency, cost estimé)
- **Migrer les call sites** :
  - `analyze-tender` : repasser sur Claude 3.5 Sonnet (OpenRouter) avec fallback Gemini — actuellement Gemini Flash uniquement, viole `mem://architecture/strategie-ia`
  - `generate-memoir`, `generate-pricing-strategy`, `generate-tender-document` : utiliser le gateway
  - `aiClassifier.ts` + `aiClassifierAnthropic.ts` : factoriser le dispatcher sur `aiGateway`
- **Bénéfice** : un seul endroit pour changer de modèle, retry cohérent, observabilité homogène.

---

## Chantier 3 — TypeScript strict mode (2-3j)

**Objectif** : activer `strict: true` et éliminer les `any`.

- **Activer dans `tsconfig.app.json`** :
  - `strict: true`
  - `noImplicitAny: true`
  - `strictNullChecks: true`
- **Corriger les ~50-100 erreurs attendues** par lots :
  1. Pages (`Tenders.tsx`, `TenderDetail.tsx`, `Dashboard.tsx`, `Pipeline.tsx`, `Sourcing.tsx`, `Onboarding.tsx`)
  2. Composants critiques (`MemoirAIChat`, `PricingChat`, `TenderAnalysisSection`, `TenderDocumentGenerator`)
  3. Hooks (`useIsAdmin`, `use-toast`)
  4. Lib (`scoring.ts`, `generatePdf.ts`, `generatePptx.ts`)
- **Typer correctement** les retours Supabase (`Database['public']['Tables']['tenders']['Row']` etc.)
- **Edge functions Deno** : appliquer également (déjà partiellement typées)
- **Bénéfice** : élimination d'une classe entière de bugs runtime, autocomplete fiable.

---

## Chantier 4 — TanStack Query partout (3-5j)

**Objectif** : remplacer les `useState/useEffect` manuels par des hooks React Query.

- **Configurer `QueryClient`** dans `App.tsx` :
  - `staleTime: 60_000` (1 min par défaut)
  - `refetchOnWindowFocus: false` pour les listes lourdes
- **Créer `src/hooks/queries/`** :
  - `useTenders(filters)` — remplace fetch manuel dans `Tenders.tsx` + `Dashboard.tsx`
  - `useTender(id)` — `TenderDetail.tsx`
  - `usePipelineItems()` — `Pipeline.tsx`
  - `useAwards()` — `Awards.tsx`
  - `useProfile()` — `Onboarding.tsx` + `SettingsPage.tsx`
  - `useSourcingUrls()` — `Sourcing.tsx`
  - `useTenderAnalyses(tenderId)` — `TenderAnalysisSection`
- **Créer `src/hooks/mutations/`** :
  - `useUpdatePipelineStage()` avec invalidation
  - `useDeleteSourcingUrl()` etc.
- **Migrer page par page**, en gardant l'ancien code jusqu'à validation
- **Bénéfice** : cache partagé entre pages, refetch automatique, états loading/error standardisés, suppression de ~300 lignes de boilerplate.

---

## Livraison & validation

À la fin de chaque chantier :
1. Build + typecheck verts
2. Test manuel sur les pages impactées
3. Validation utilisateur avant de passer au chantier suivant

## Notes techniques

- Les chantiers 1 et 2 touchent uniquement le backend Supabase (functions + migrations), aucun risque UI.
- Le chantier 3 (strict) peut révéler des bugs latents — prévoir une demi-journée de marge.
- Le chantier 4 est le plus visible côté UX (loading states plus rapides grâce au cache).
- Les Quick Wins de l'audit (`.env` git, auth guards, etc.) sont **hors scope** de ce plan stratégique — à traiter séparément si besoin.