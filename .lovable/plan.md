## Diagnostic

Tu ne vois rien car le frontend attend le `run_id` pour lire `agent_runs.live_view_url`, mais aujourd’hui le `run_id` n’arrive au composant qu’à la fin de l’appel `fetch-dce-agent`. Comme l’Edge Function reste bloquée pendant toute l’exécution de l’agent, le composant ne peut pas commencer à poller la ligne en base pendant que Browserbase tourne.

Les logs confirment pourtant que Browserbase génère bien l’URL live : `live_view.ready` est OK côté Edge Function.

## Plan de correction

1. **Créer le `run_id` côté frontend avant l’appel long**
   - Générer un UUID dans `DceAgentFetchButton.tsx` dès le clic.
   - Mettre immédiatement `setRunId(runId)` pour démarrer le polling avant que l’Edge Function ne réponde.

2. **Passer ce `run_id` à l’Edge Function**
   - Ajouter `run_id` dans le body de `supabase.functions.invoke("fetch-dce-agent")`.
   - L’Edge Function utilisera cet ID pour insérer/mettre à jour `agent_runs`.

3. **Adapter `fetch-dce-agent`**
   - Lire `run_id` depuis le body.
   - Insérer `agent_runs` avec cet ID s’il est fourni.
   - Garder le comportement actuel en fallback si aucun `run_id` n’est envoyé.

4. **Améliorer l’état affiché côté UI**
   - Afficher un message du type “Ouverture du navigateur live…” tant que `live_view_url` n’est pas encore disponible.
   - Dès que `live_view_url` arrive, afficher l’iframe + le bouton “Ouvrir en grand”.

## Résultat attendu

En cliquant sur “Récupérer le DCE automatiquement”, le panneau live apparaîtra pendant l’exécution, sans attendre la fin ou le timeout de l’agent.