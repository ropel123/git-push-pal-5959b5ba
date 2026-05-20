# Plan — Finalisation des 4 résiduels

Refacto chirurgical, zéro changement UI/UX. Tout en un commit.

## 1. Pipeline — Realtime + Optimistic updates

**Fichier** : `src/hooks/queries/usePipeline.ts`

- Ajouter `useEffect` dans `usePipelineItems` qui souscrit au channel Supabase `postgres_changes` sur `pipeline_items` filtré par `user_id=eq.{userId}`. À chaque event, invalider `["pipeline-items", userId]` + `["pipeline-distribution"]` + `["dashboard-stats"]`.
- `useUpdatePipelineStage` : ajouter `onMutate` qui patch optimistiquement toutes les queries `["pipeline-items", *]` du cache (snapshot + rollback en `onError`, invalidation finale en `onSettled`).
- `useRemovePipelineItem` : même pattern (filter optimiste, rollback, invalidation finale).
- `Pipeline.tsx` : aucun changement (l'API des hooks reste identique).

**Gain** : drag-drop instantané, multi-utilisateurs/multi-onglets synchronisés.

## 2. Sourcing.tsx — Migration TanStack Query

**Nouveau fichier** : `src/hooks/queries/useSourcingAdmin.ts`

```ts
export function useSourcingUrls(enabled: boolean)     // sourcing_urls *
export function useScrapeLogs(enabled: boolean)       // scrape_logs source LIKE 'scrape:%' limit 50
```

Chaque hook retourne `{ data, isLoading, refetch }`. `enabled` câblé sur `isAdmin`.

**Refacto `src/pages/Sourcing.tsx`** :
- Supprimer `useState<SourcingUrl[]>([])` / `useState<ScrapeLog[]>([])` / `useState(true)` (loading) / la fonction `load()` / le `useEffect` qui appelle `load()`.
- Remplacer par `const { data: urls = [], isLoading, refetch } = useSourcingUrls(!!isAdmin)` et idem pour `logs`.
- Toutes les mutations existantes (`addUrl`, `bulkImport`, `toggleActive`, `remove`, `saveEdit`, `runNow`, `dryRun`, `reclassifyOne`, `reclassifyAll`, `runAtexoBackfill`) : remplacer `load()` par `refetch()`.

**Gain** : cache automatique, plus de race conditions sur la fonction `load()`.

## 3. AgentMonitor.tsx — Migration TanStack Query

**Nouveau fichier** : `src/hooks/queries/useAgentAdmin.ts`

```ts
export function useAgentRuns(enabled: boolean)        // agent_runs order created_at desc limit 50
export function usePlatformRobots(enabled: boolean)   // platform_robots order platform
export function useAgentPlaybooks(enabled: boolean)   // agent_playbooks order platform
export function useAnonIdentity(enabled: boolean)     // agent_anonymous_identity is_default=true
```

Chaque hook supporte realtime invalidation pour les `agent_runs` (subscription existante actuellement câblée dans le composant → la déplacer dans le hook).

**Refacto `src/pages/AgentMonitor.tsx`** :
- Supprimer les 4 `useState` listes + `setLoading` + `loadAll()` + le `useEffect` qui contient la subscription realtime.
- Brancher les 4 hooks avec `enabled: !!isAdmin`.
- Mutations (`addRobot`, `deleteRobot`, `runTest`, `saveIdentity`) : remplacer `loadAll()` par `refetch()` ciblé (ex: `refetchRobots()` après ajout/suppression).

**Gain** : suppression du pattern `loadAll()` qui rafraîchit 4 tables à chaque mutation, realtime déplacé dans le hook (réutilisable).

## 4. DceUploadSection + MemoirAIChat — Mutations TanStack

**Nouveau fichier** : `src/hooks/mutations/useDceUploads.ts`

```ts
export function useUploadDce()    // storage.upload + dce_uploads.insert
export function useDeleteDce()    // storage.remove + dce_uploads.delete
```

Invalident `["dce-uploads", tenderId]` en `onSuccess`.

**Nouveau fichier** : `src/hooks/queries/useDceUploads.ts`

```ts
export function useDceUploads(tenderId: string, userId?: string)  // read dce_uploads
```

**Refacto** :
- `src/components/DceUploadSection.tsx` : remplacer les appels directs `supabase.from/storage` dans `uploadFile` et `deleteFile` par les hooks. La prop `onUploadsChange` devient optionnelle (le cache gère).
- `src/pages/TenderDetail.tsx` : remplacer la lecture inline `dce_uploads` par `useDceUploads(id, user?.id)`, supprimer le state local correspondant.

**Refacto `src/components/MemoirAIChat.tsx`** :
- Wrapper l'`update profiles` de `handleSaveMemoir` dans une mutation TanStack qui invalide `["profile", userId]`.
- La prop `onMemoirSaved` reste (utilisée par Onboarding pour navigation + par SettingsPage déjà sur `refetchProfile`).

**Gain** : cohérence avec le reste du code, plus de callbacks manuels.

## Validation

- `tsc --noEmit` : 0 erreur (strict est actif depuis le chantier 3).
- Smoke test : `/pipeline` (drag cards + ouvrir 2 onglets pour vérifier le realtime), `/sourcing` (admin only), `/agent-monitor` (admin only), `/tenders/:id` (upload/delete DCE), `/settings` (sauvegarde mémoire technique).

## Hors scope

- Refonte UI des pages admin.
- Migration des edge functions.
- Migration de `Onboarding.tsx` (déjà clean, juste consommateur de MemoirAIChat).
