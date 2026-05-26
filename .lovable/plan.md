Faire passer MPI par le flux Browserbase + LLM-pick (comme Atexo), avec authentification réelle via les secrets `MPI_LOGIN` / `MPI_PASSWORD`. Pas d'identité anonyme pour MPI.

## Changements code

**`supabase/functions/fetch-dce-agent/index.ts`** — déjà appliqué :
- Suppression du fast-path HTTP MPI (plus d'appel à `fetch-dce-mpi`).
- Dans le chargement du robot : si `platform === "mpi"` et qu'il n'y a aucune ligne dans `platform_robots`, on lit `MPI_LOGIN` / `MPI_PASSWORD` depuis l'environnement et on les utilise comme robot (login + password).

## Changement base de données (migration à exécuter)

Mettre à jour le playbook `mpi` dans `agent_playbooks` pour refléter le tunnel réel MPI authentifié :

```text
1.  navigate                  → ouvre l'URL DCE (page acheteur Grand Est, etc.)
2.  wait 2s
3.  click_if_present          → "Dossier de Consultation des Entreprises"
4.  wait 1.5s
5.  wait_for_inputs (min=2)   → écran de login MPI
6.  fill_login                → MPI_LOGIN / MPI_PASSWORD (via secrets, fallback déjà codé)
7.  click_if_present          → "Se connecter / Valider"
8.  wait 2s
9.  act_if_present            → cocher tous les lots disponibles
10. act_if_present            → cocher CGU / certifications si présentes
11. click_if_present          → "Suivant / Valider / Continuer"
12. wait 1.5s
13. solve_image_captcha_if_present
14. act_if_present            → bouton final "RETRAIT / TÉLÉCHARGER / Télécharger le DCE"
15. wait_download (75s)
```

**Pas** de `fill_anonymous_identity` dans ce playbook : MPI exige un vrai compte.

## Edge function legacy

`fetch-dce-mpi` reste en place (non appelée) — peut être supprimée plus tard une fois le nouveau flux validé en prod.

## Validation

- Re-cliquer "Récupérer le DCE automatiquement" sur le tender `20abaed5-...` (Grand Est, lien MPI).
- Logs attendus :
  - `router.detect_platform` → `mpi`
  - `playbook.load` → `MPI / AWS achat (marches-publics.info)`
  - `robot.load` → `ok ... (via env MPI_LOGIN)`
  - étapes 1..15 jusqu'à `wait_download ok`
- Le ZIP DCE doit apparaître dans `dce-documents`.