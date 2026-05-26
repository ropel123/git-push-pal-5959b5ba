# Refonte MPI : anonyme par défaut + multi-téléchargements

## Problèmes constatés

D'après la trace + les captures :

1. **Le playbook MPI actuel attaque en mode "identifié"** (`wait_for_inputs min=2` → `fill_login` → `click "Se connecter"`). Or la page d'entrée MPI propose souvent directement un `RETRAIT` anonyme (1 seul input = captcha). Les étapes login sont skippées, on perd ~5s de bruit, puis on clique enfin RETRAIT.
2. **Aucune branche "anonyme vs identifié"** : sur certaines consultations MPI, la page affiche deux boutons côte à côte `RETRAIT ANONYME` / `RETRAIT IDENTIFIE` (capture 2). Le playbook actuel ne les distingue pas.
3. **Aucune gestion de la page AW Solutions multi-pièces** (capture 3) : après le clic RETRAIT, on arrive sur une page avec un bouton `Télécharger` par pièce (AAPC, Règlement, Dossier principal…). Le playbook se contente d'un `wait_download 75s` passif qui ne déclenche aucun téléchargement → wallclock timeout 110s.

## Décision retenue : **"Auto selon la page"**

- Anonyme prioritaire (pas de creds, plus rapide, captcha simple).
- Si la page exige strictement le login (champ password présent et pas de bouton RETRAIT visible), fallback identifié avec `MPI_LOGIN/MPI_PASSWORD`.

## Changements

### 1. Nouveau playbook MPI (table `agent_playbooks`, platform=`mpi`)

Remplacer les `steps` par une séquence "détection puis branchement" :

```text
1. navigate(dce_url)
2. wait 1500ms
3. extract_href_and_navigate "Dossier de Consultation des Entreprises"
4. wait 2500ms
5. solve_image_captcha_if_present              ← captcha avant tout (présent sur les 2 variantes)
6. click_if_present "RETRAIT ANONYME"          ← variante capture 2
7. click_if_present "RETRAIT"                  ← variante capture 1 (skip si déjà cliqué)
8. wait 2500ms
9. branch_login_if_required:                   ← nouvelle action (cf. §2)
     - si écran login détecté → fill_login + click "Se connecter" + wait + re-captcha si présent
10. download_all_pieces                        ← nouvelle action (cf. §3)
```

`continue_on_error: true` dans `config` pour ne pas casser sur les étapes optionnelles.

### 2. Nouvelle action `branch_login_if_required` dans l'edge function

`supabase/functions/fetch-dce-agent/index.ts` — ajouter un `case` dans le switch :

- Réutilise `jsDetectLoginScreen()` (déjà présent).
- Si écran login + `robot` (MPI_LOGIN/MPI_PASSWORD) disponible → exécute `fill_login` + clic submit + wait + re-tente captcha.
- Sinon skip (on est en anonyme, ou pas de creds dispo).

### 3. Nouvelle action `download_all_pieces`

Toujours dans l'edge function. Logique :

- Snapshot de tous les boutons/inputs dont le texte matche `Télécharger|Telecharger|Download|RETRAIT` sur la page AW Solutions.
- Pour chacun : clic séquentiel + attente courte (3-5s) entre chaque pour laisser Browserbase capturer le download.
- Incrémente `files_downloaded` à chaque clic réussi.
- Log compact : `download_all_pieces ok — 5 pièces téléchargées`.

Bonus : si un bouton "Tout télécharger" / "Télécharger tout" est détecté → cliquer uniquement celui-ci et skip les individuels.

### 4. Migration

Une seule migration SQL pour `UPDATE agent_playbooks SET steps=…, config=… WHERE platform='mpi'`. Pas de nouvelle table, pas de nouveau secret (MPI_LOGIN/MPI_PASSWORD déjà présents).

### 5. Pas de changement front

Le bouton `DceAgentFetchButton.tsx` continue d'appeler `fetch-dce-agent` avec le `run_id` côté client (correctif live-view déjà en place). On verra juste le live-view dérouler le nouveau parcours.

## Détails techniques

- Les actions `branch_login_if_required` et `download_all_pieces` sont ajoutées comme `case` dans le `switch (step.action)` autour de la ligne 1165 de `index.ts`, dans le même style que `fill_login` et `wait_download`.
- `download_all_pieces` utilisera `jsSnapshotClickables()` (déjà présent) filtré sur le regex texte, puis `jsClickByIndex(i)` (déjà présent) en boucle.
- Aucun changement des helpers Browserbase / CDP / captcha existants.
- Timeout wallclock global (110s) inchangé — la nouvelle séquence est ~30-45s en moyenne (captcha 5s + 1 clic RETRAIT + N×3s pour les pièces, N≤6).

## Vérification

Après déploiement, je relancerai l'agent sur le même DCE (`/tenders/5e1edfec-…`) et je vérifierai dans la trace :

- ligne `RETRAIT` clickée via heuristique (anonyme),
- aucune étape `fill_login` (sauf si la page le réclame),
- `download_all_pieces ok — N pièces` avec `files_downloaded = N` en base,
- entrées correspondantes dans `dce_uploads` / bucket `dce-documents`.
