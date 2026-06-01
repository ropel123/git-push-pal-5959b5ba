## Problème

L’agent atteint bien le bon playbook Atexo SPL, mais après le clic “Valider” sur le choix anonyme, la page n’affiche aucun input (`0 inputs`). Le playbook continue quand même jusqu’à l’étape stricte “SUBMIT final”, qui échoue avec un 500 car la page est revenue à un menu (Se connecter, Annonces, Signature). Conclusion : la session a expiré ou Atexo a invalidé le retrait anonyme après le `Valider`, on tape sur un mauvais écran.

## Correctif minimal

1. **Playbook `atexo_spl` (migration UPDATE)**
   - Insérer juste avant le submit final une étape `wait_for_inputs` (min 1, 6s).
   - Convertir l’étape “Bouton SUBMIT final” de `act` (strict) en `act_if_present` pour éviter l’erreur 500 quand la page n’est pas dans l’état attendu.
   - Ajouter une étape `act_if_present` qui re-clique le bouton de retrait DCE si on est revenu sur la page consultation (re-entry après expiration).

2. **`fetch-dce-agent/index.ts`**
   - Pour l’étape finale Atexo, si `wait_for_inputs` reporte 0 inputs ET qu’aucun bouton submit n’est trouvé, remonter une erreur explicite `atexo_session_expired_after_anonymous_choice` au lieu de l’erreur générique “Aucun bouton/lien…”.
   - Garder la trace actuelle inchangée.

3. **Validation**
   - Relancer le run sur `marches-publics.regionreunion.com/.../506529`.
   - Vérifier que la trace finit soit par un téléchargement réussi, soit par un `skipped` propre, sans 500.

Pas d’autre fichier touché. Aucun changement frontend.