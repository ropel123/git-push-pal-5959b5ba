# Plan — Chantier 4 (fin) puis Chantier 3 (TS strict)

Livraison séquentielle : un seul plan ici pour le **chantier 4**, qui sera ouvert et validé en autonomie. Une fois mergé, j'ouvre un **second plan dédié** au chantier 3 (TS strict) pour ne pas mélanger les diffs.

---

## Chantier 4 — Migration TanStack Query (suite et fin)

### Pages restantes à migrer

| Page | Lectures actuelles | Hook(s) à créer |
|---|---|---|
| `Dashboard.tsx` | 6 requêtes (counts tenders/pipeline, monthly, pipeline distribution, recent pipeline, urgent, saved searches) | `useDashboardStats`, `useTendersMonthly`, `usePipelineDistribution`, `useRecentPipeline`, `useUrgentTenders`, `useSavedSearches` |
| `Pipeline.tsx` | pipeline_items + comments + mutations stage/notes | `usePipelineItems`, `usePipelineComments`, mutations `useMovePipelineStage`, `useUpdatePipelineNotes`, `useAddPipelineComment` |
| `Awards.tsx` | award_notices joints aux tenders | `useAwards` |
| `BuyerDetail.tsx` | tenders d'un acheteur + awards associés | `useBuyerTenders`, réutilise `useAwards` filtré |
| `SettingsPage.tsx` | profil + logo + roles | `useProfile`, mutation `useUpdateProfile` |
| `Sourcing.tsx` | sourcing_urls + scrape_logs (admin) | `useSourcingUrls`, `useScrapeLogs`, mutations CRUD |
| `AgentMonitor.tsx` | agent_runs + playbooks (admin) | `useAgentRuns`, `useAgentPlaybooks` |
| `Activity.tsx` | logs récents | `useActivityFeed` |

### Structure cible

```text
src/hooks/
  queries/
    useTenders.ts          (déjà fait)
    useDashboard.ts        (regroupe stats + monthly + distribution)
    usePipeline.ts         (items + comments)
    useAwards.ts
    useBuyer.ts
    useProfile.ts
    useSourcing.ts
    useAgentRuns.ts
    useActivity.ts
    useSavedSearches.ts
  mutations/
    usePipelineMutations.ts
    useProfileMutations.ts
    useSavedSearchMutations.ts
    useSourcingMutations.ts
  useDebounce.ts           (déjà fait)
```

### Conventions appliquées

- `queryKey` typé en tableau `["domain", paramsObject]`, paramsObject sérialisable.
- `enabled` systématique quand la query dépend de `user.id` ou d'un param.
- `placeholderData: keepPreviousData` sur les listes paginées.
- Mutations : `onSuccess` invalide les `queryKey` impactées (`queryClient.invalidateQueries({ queryKey: ["pipeline"] })`) → suppression des `fetchX()` manuels après écriture.
- Toasts d'erreur centralisés via `onError` (utiliser le `useToast` existant).
- Aucun changement de UI/UX visible — comportement strictement équivalent, juste mise en cache + refetch automatique au refocus.

### Ordre d'exécution (2-3 jours)

1. **Jour 1** — Dashboard + Awards + BuyerDetail (lectures simples, fort gain perçu sur le retour à `/dashboard`).
2. **Jour 2** — Pipeline (avec mutations stage/notes/comments) + SavedSearches (partagé Dashboard/Tenders).
3. **Jour 3** — SettingsPage + Sourcing + AgentMonitor + Activity (pages secondaires/admin).

### Validation

- Build vert, smoke test manuel route par route (Dashboard, /tenders, /tenders/:id, /pipeline, /awards, /buyers/:id, /settings, /sourcing, /agent-monitor, /activity).
- Vérifier React Query DevTools (déjà présent) : pas de query dupliquée, pas de refetch en boucle.
- Vérifier qu'aucun `setX` n'est resté dans les useEffect remplacés (grep `setLoading|setTenders|setItems...`).

### Hors scope (volontaire)

- Subscriptions realtime Supabase (à traiter dans un chantier ultérieur si besoin).
- Optimistic updates fines sur le Kanban (peut être ajouté en option si le drag-drop perd en fluidité).
- Migration des composants `DceUploadSection` / `MemoirAIChat` (UI lourde, peu de gain — restent en `supabase.from` direct).

---

## Chantier 3 — TypeScript strict (plan séparé après merge du chantier 4)

À l'issue du chantier 4, j'ouvre un **nouveau plan** structuré ainsi :

1. **Audit préalable** : activer `strict: true` localement, compter et catégoriser les erreurs (`tsc --noEmit | sort | uniq -c`).
2. **Découpage par lot** :
   - Lot A : `src/lib/*`, `src/hooks/*` (fondations).
   - Lot B : `src/components/ui/*` (peu d'erreurs, surtout `noImplicitAny`).
   - Lot C : `src/components/*` (composants métier).
   - Lot D : `src/pages/*` (typiquement les plus gros).
   - Lot E : `supabase/functions/*` (Deno, tsconfig séparé).
3. **Stratégie de correction** :
   - Remplacer `any` par les types `Database["public"]["Tables"][...]["Row"]` de `integrations/supabase/types.ts`.
   - Ajouter `null` guards sur les `.data` Supabase.
   - Préciser les `useState<T>()` non initialisés.
   - **Aucun `// @ts-expect-error`** sauf cas documenté.
4. **Activation finale** : commit unique qui flip `strict: true` une fois tous les lots verts.
5. **Validation** : `tsc --noEmit` 0 erreur + build vert + run de l'app.

Le chantier 3 sera estimé plus précisément après l'audit du lot 1 (probablement 2-3 jours mais peut s'étendre selon le volume réel d'erreurs).

---

## Décision demandée

Approuve ce plan pour lancer le **chantier 4** (fin de migration TanStack Query). Le chantier 3 sera proposé dans un plan dédié juste après.
