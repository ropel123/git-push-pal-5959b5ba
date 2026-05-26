Objectif : supprimer le fast-path HTTP MPI et faire passer MPI par la même infra que Atexo (Browserbase + playbook 10 steps + LLM-pick).

## Changements

1. **`supabase/functions/fetch-dce-agent/index.ts`** — supprimer le bloc fast-path MPI (lignes ~1038-1049) :
   ```ts
   if (platform === "mpi" && MPI_LOGIN && MPI_PASSWORD) { ... }
   ```
   MPI tombera alors dans le flux normal : chargement du playbook `mpi` (déjà actif, 10 steps en base) → Browserbase → exécution étape par étape avec LLM-pick sur les `act`.

2. **Playbook MPI** — vérifier les 10 steps en base et les ajuster si besoin pour couvrir le tunnel Grand Est :
   - goto `{{dce_url}}` (la page publication du buyer profile)
   - act "Dossier de Consultation des Entreprises" (le lien sur la page acheteur)
   - wait_for_inputs → login MPI
   - fill identifiant / mot de passe (via secrets `MPI_LOGIN` / `MPI_PASSWORD`)
   - act "Se connecter"
   - act "Sélectionner tous les lots" / cocher checkboxes
   - act "Suivant" / "Valider"
   - act "J'accepte les CGU" si présent
   - act "Télécharger le DCE"
   - capture download via API Browserbase

3. **Garder le fichier `fetch-dce-mpi`** désactivé (ne plus l'appeler) mais ne pas le supprimer immédiatement, au cas où on veuille revenir au HTTP pur plus tard. On le marquera comme legacy.

4. **Logs** — vérifier que les events `router.detect_platform` → `playbook.load mpi` → `step.act("...")` remontent bien comme pour Atexo.

## Détails techniques

- Aucune nouvelle dépendance, aucun nouveau secret (BROWSERBASE_API_KEY, MPI_LOGIN, MPI_PASSWORD déjà présents).
- Coût passe de ~0,001 $ à ~0,15 $ par DCE MPI (Browserbase + captcha éventuel) — acceptable vs taux d'échec actuel.
- Migration SQL si on doit corriger les steps du playbook `mpi`.

## Validation

- Re-cliquer "Récupérer le DCE automatiquement" sur le tender Grand Est `20abaed5-...`.
- Vérifier dans les logs : `router.detect_platform mpi` → `playbook.load MPI / AWS achat` → progression des steps jusqu'au download.
- Le ZIP doit apparaître dans `dce-documents`.