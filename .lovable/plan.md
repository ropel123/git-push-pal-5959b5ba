

## Diagnostic

"Aucun upload lié à ce run" → la query `dce_uploads.agent_run_id = run.id` ne renvoie rien parce que **le fichier a été uploadé AVANT que la migration `agent_run_id` n'existe**. Le ZIP de 1.41 MB est dans le storage mais sa ligne `dce_uploads` a `agent_run_id = NULL`.

Deux problèmes :

1. **Run historique orphelin** : le fichier `agent_1776372623578.zip` existe dans `dce-documents/00000000-.../` mais n'est lié à aucun run via `agent_run_id`.
2. **Fallback insuffisant** : le code actuel fait `agent_run_id = runId` puis fallback `tender_id`. Mais sur les runs test, plusieurs runs partagent le même `tender_id = 00000000...` → le fallback retourne potentiellement le **mauvais** fichier (ou rien si la query est mal ordonnée).

## Plan

### 1. Backfill des uploads orphelins (one-shot SQL)

Lier rétroactivement les `dce_uploads` existants à leur `agent_run` par **proximité temporelle** (upload `created_at` entre `agent_run.started_at` et `agent_run.finished_at`) :

```sql
UPDATE public.dce_uploads u
SET agent_run_id = r.id
FROM public.agent_runs r
WHERE u.agent_run_id IS NULL
  AND u.tender_id = r.tender_id
  AND u.created_at BETWEEN r.started_at AND COALESCE(r.finished_at, r.started_at + interval '5 minutes');
```

### 2. Améliorer `downloadDce` côté UI (`AgentMonitor.tsx`)

Stratégie en cascade plus robuste :
1. Cherche par `agent_run_id = run.id` (exact)
2. Sinon : cherche par `tender_id = run.tender_id` ET `created_at` dans la fenêtre `[run.started_at, run.finished_at + 1min]`, ordonné par `created_at DESC`, limit 1
3. Sinon : fallback storage direct → liste les fichiers dans `dce-documents/{tender_id}/` créés dans la fenêtre, prend le plus récent et génère signed URL
4. Toast d'erreur seulement si les 3 stratégies échouent, avec message qui indique le chemin storage à vérifier manuellement

### 3. (Bonus) Lien direct "Voir dans Storage"

Sur le toast d'erreur, ajouter un bouton/lien vers le dashboard Supabase Storage (`https://supabase.com/dashboard/project/xfqvaeshidleazgfqlze/storage/buckets/dce-documents`) pour que tu puisses récupérer manuellement le fichier en attendant.

## Fichiers touchés

- **Migration SQL** : backfill `dce_uploads.agent_run_id` pour les uploads existants
- **`src/pages/AgentMonitor.tsx`** : fonction `downloadDce` enrichie (cascade 3 niveaux + lien storage dashboard)

## Note

Le fichier `agent_1776372623578.zip` (1.41 MB, ton DCE Maximilien) est **bien là**, il faut juste le retrouver. Le backfill SQL le rattachera au run correspondant et le bouton fonctionnera.

