

## Diagnostic

Le téléchargement DCE a réussi (1.41 MB ✓), mais le fichier est invisible parce que **la page `/agent-monitor` est un mode test** qui force `tender_id = "00000000-0000-0000-0000-000000000000"` (UUID nul). Conséquence :

1. Le fichier est uploadé dans `dce-documents/00000000-.../agent_xxx.zip`
2. La ligne `dce_uploads` est créée avec ce tender_id nul → **n'apparaît dans aucune page `/tenders/:id`**
3. La page `/agent-monitor` affiche seulement la trace, pas de bouton de téléchargement

Donc tu n'as **aucun moyen UI** de récupérer le fichier sauf via `agent-monitor` lui-même.

## Plan : ajouter un bouton "Télécharger le DCE" dans /agent-monitor

### 1. Côté UI (`src/pages/AgentMonitor.tsx`)

Pour chaque `agent_run` avec `status === "success"` ET `files_downloaded > 0` :
- Bouton **"Télécharger le DCE"** (icône `FileDown`)
- Au clic : appeler une fonction qui retrouve le fichier dans `dce_uploads` filtré par `agent_run_id` (préféré) ou par `tender_id + created_at` proche du run, génère un signed URL via `supabase.storage.createSignedUrl()`, et déclenche le téléchargement navigateur.

### 2. Lier `agent_runs` ↔ `dce_uploads`

Aujourd'hui rien ne relie un upload à son run. Deux options :
- **A. Ajouter `agent_run_id` à `dce_uploads`** (migration : nouvelle colonne nullable + index). L'edge function l'insère lors de l'upload. **Choix recommandé** : robuste, évite les ambiguïtés.
- B. Match par `tender_id` + `file_path` qui contient déjà le run ID dans le nom.

→ Aller avec **A**. Migration légère :
```sql
ALTER TABLE public.dce_uploads ADD COLUMN agent_run_id uuid REFERENCES public.agent_runs(id) ON DELETE SET NULL;
CREATE INDEX idx_dce_uploads_agent_run_id ON public.dce_uploads(agent_run_id);
```

### 3. Edge function (`supabase/functions/fetch-dce-agent/index.ts`)

Insertion `dce_uploads` modifiée pour passer `agent_run_id: runId` (déjà disponible localement dans la fonction).

### 4. UI : carte "DCE récupéré" dans le détail du run

Dans le drawer/dialog d'un run sur `/agent-monitor`, sous la trace, ajouter une carte verte avec :
- Nom du fichier + taille
- Bouton **"Télécharger"** → signed URL 1h → download navigateur

Si le run est "test" (tender_id nul), c'est le **seul** moyen de récupérer le fichier → fonctionnalité critique.

### 5. (Bonus rapide) Améliorer la detection "Continuer" sur Maximilien

Les logs montrent que `click_if_present("Continuer/Suivant/Valider...")` a heuristic-matché un bouton **"Valider"** **avant** que la radio "anonyme" ne déclenche son postback → on a cliqué Valider trop tôt sur un formulaire vide → `wait_for_inputs` 0/2. 

Reformuler l'instruction pour exclure "Valider" du step intermédiaire :
> "Bouton **Continuer** ou **Suivant** uniquement (PAS Valider, PAS Télécharger) — étape intermédiaire après sélection du mode anonyme"

Migration SQL légère pour mettre à jour ce step. **Mais** le run a quand même réussi finalement (le `act` final LLM-first a trouvé "Télécharger le Dossier de consultation" idx=12), donc c'est optionnel.

## Fichiers touchés

- **Migration SQL** : ajouter colonne `agent_run_id` à `dce_uploads` + index
- **`supabase/functions/fetch-dce-agent/index.ts`** : passer `agent_run_id: runId` à l'insert (~1 ligne)
- **`src/pages/AgentMonitor.tsx`** : bouton "Télécharger le DCE" sur chaque run success + handler signed URL (~30 lignes)
- (optionnel) Migration Maximilien playbook : reformuler step "Continuer/Suivant"

## Note

Tu peux aussi récupérer le fichier **dès maintenant** sans aucun code en allant sur Supabase Storage > bucket `dce-documents` > dossier `00000000-0000-0000-0000-000000000000/` et en téléchargeant `agent_1776372623578.zip` (1.41 MB). Mais c'est pas viable long terme — le bouton dans `/agent-monitor` est le bon fix.

