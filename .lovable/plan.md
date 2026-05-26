## Plan

Le blocage est maintenant plus loin que le login : l’agent arrive bien en **mode retrait anonyme** sur la page `dce.verifLotsDCE`, mais l’action actuelle `download_all_pieces` cherche seulement des boutons/liens de téléchargement. Elle ne coche pas les lots avant de cliquer sur `Télécharger les DCE sélectionnés`, donc aucun fichier n’est téléchargé.

## Correction proposée

1. **Renforcer l’action `download_all_pieces` dans `fetch-dce-agent`**
   - Détecter la page MPI de sélection des lots (`verifLotsDCE`, texte “Sélectionner tous les lots”, cases à cocher de lots).
   - Cocher d’abord la case **“Sélectionner tous les lots”** si elle existe.
   - Si cette case ne déclenche pas correctement la sélection, fallback : cocher toutes les cases visibles/activables de lots.
   - Déclencher les événements navigateur attendus (`click`, `input`, `change`) pour que le JavaScript MPI valide bien la sélection.

2. **Soumettre le formulaire MPI proprement**
   - Cliquer sur le bouton `Télécharger les DCE sélectionnés`.
   - Si le clic ne suffit pas, utiliser `form.requestSubmit()` / soumission native du formulaire comme fallback.
   - Attendre le démarrage du téléchargement avant de passer à l’étape `wait_download`.

3. **Mettre à jour le playbook MPI uniquement si nécessaire**
   - Garder la séquence actuelle qui force le `mode anonyme`.
   - Optionnellement remplacer l’étape finale par une instruction plus explicite si on ajoute une action dédiée, mais le plus simple est d’améliorer `download_all_pieces` sans migration supplémentaire.

4. **Vérification**
   - Relancer l’agent sur le même DCE.
   - Attendu dans la trace : lots cochés, bouton `Télécharger les DCE sélectionnés` soumis, puis `files_downloaded > 0` et création d’une entrée `dce_uploads`.

## Détails techniques

- Fichier principal : `supabase/functions/fetch-dce-agent/index.ts`.
- Aucun changement UI requis.
- Aucun changement de schéma Supabase requis.
- Déploiement automatique de l’Edge Function après modification.