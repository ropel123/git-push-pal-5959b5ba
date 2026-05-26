## Objectif
Corriger l’erreur 500 du bouton DCE Agent sur MPI : la session est considérée comme valide, mais la page obtenue après redirection (`dematEnt.choixDCE`) n’est pas reconnue comme une page DCE téléchargeable, donc `downloadDce` échoue avec `lots/télécharger not found`.

## Plan de correction
1. **Renforcer la détection de session MPI**
   - Dans `supabase/functions/_shared/mpiClient.ts`, ajuster `isLoginRequired` pour ne pas considérer `dematEnt.login&type=DCE` comme un login requis quand la page redirige déjà vers une étape DCE authentifiée.
   - Éviter que `cookies={}` en base soit traité comme une session réutilisable valide.

2. **Gérer l’étape MPI `choixDCE`**
   - Étendre `downloadDce` pour reconnaître les pages intermédiaires `dematEnt.choixDCE` / `verifLotsDCE`.
   - Si la page contient un formulaire ou des liens vers l’étape suivante, soumettre/suivre cette étape avant de chercher le formulaire final de téléchargement.
   - Conserver l’envoi de toutes les cases “lot” quand elles sont présentes.

3. **Améliorer les logs de diagnostic**
   - Ajouter des logs courts indiquant l’URL finale, le `content-type`, la présence de formulaires, de checkboxes et un extrait du titre/page quand la page DCE n’est pas reconnue.
   - Renvoyer une erreur plus explicite côté `fetch-dce-mpi`, afin que `fetch-dce-agent` affiche autre chose qu’un simple `non-2xx`.

4. **Vérifier sans modifier le parcours Browserbase générique**
   - Garder le fast-path MPI isolé.
   - Ne pas toucher aux playbooks ni au flux des autres plateformes.

## Fichiers concernés
- `supabase/functions/_shared/mpiClient.ts`
- `supabase/functions/fetch-dce-mpi/index.ts`
- Optionnellement `supabase/functions/fetch-dce-agent/index.ts` uniquement pour propager un message d’erreur plus lisible depuis la fonction MPI.

## Validation
- Redéployer `fetch-dce-mpi` après correction.
- Relancer le bouton DCE Agent sur l’AO courant.
- Vérifier dans les logs que le flux passe bien : résolution URL → éventuel login/captcha → choix lots → téléchargement → upload storage.