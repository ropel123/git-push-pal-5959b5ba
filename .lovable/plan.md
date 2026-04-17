

## Diagnostic précis (run 09071431)

La trace dit tout :

1. ✅ Navigation OK sur `marches-publics.info/mpiaws/...?typeErreur=captchaVide`
2. ⏭ `click_if_present("Télécharger le DCE…")` → skipped, page déjà sur le formulaire de retrait (top5 montre déjà `input "RETRAIT"` + `bordereau de retrait` + `Documentation sur les dépôts`)
3. ⏭ `wait_for_inputs(min=2)` → skipped (1 seul input vu en 8s)
4. ⏭ `fill_anonymous_identity` → skipped (aucun champ mappé)
5. ❌ `act("Cocher toutes les cases…")` → **FATAL**

**Trois problèmes structurels** :

### Problème 1 : un step `act/click_if_present` qui ne trouve rien casse tout le run
Le moteur traite l'absence de match comme une erreur fatale au lieu d'un skip propre. Sur des pages où la case "CGU" n'existe pas (ex: page MPI déjà partiellement validée), tout le playbook plante.

### Problème 2 : MPI rend ses formulaires en `<iframe>` ou via JS différé
La page Dordogne (`typeErreur=captchaVide` = retour d'une tentative précédente avec captcha vide) ne montre qu'1 input parce que le formulaire identité est probablement dans une iframe ou un panel caché. L'agent ne fouille pas les iframes.

### Problème 3 : pas de `act_if_present` (variante non-bloquante de `act`)
On a `click_if_present` mais pas `act_if_present`. Du coup l'étape "cocher CGU" est obligatoire et casse tout si les cases ne sont pas là.

## Plan de correction

### 1. Nouveau step `act_if_present` (non-bloquant)
Variante de `act` qui retourne `skipped` au lieu de `failed` quand aucun élément ne match. À utiliser pour toutes les étapes optionnelles (CGU, accepter conditions, etc.).

### 2. Mode `continue_on_error` global du playbook
Ajouter un flag dans la config playbook : si `true`, un step `failed` log l'erreur mais ne stoppe pas le run — le moteur passe au step suivant. Idéal pour `generic` et `mpi` où la séquence n'est pas linéaire.

### 3. Support des iframes dans `wait_for_inputs` et `fill_anonymous_identity`
Étendre les helpers DOM JS pour parcourir aussi `document.querySelectorAll('iframe')` → `iframe.contentDocument` (cross-origin permitting). Sur MPI tout est same-origin donc accessible.

### 4. Mise à jour playbooks `mpi` et `generic`
- Remplacer `act("Cocher CGU…")` par `act_if_present("Cocher CGU…")`
- Remplacer `act("Cliquer RETRAIT…")` par cascade : `click_if_present("RETRAIT")` (heuristique sur input value) → fallback `act("Cliquer RETRAIT")` 
- Activer `continue_on_error: true` sur le playbook generic

### 5. Heuristique RETRAIT prioritaire pour MPI
Le top5 montre déjà `input "RETRAIT"` — c'est un `<input type="submit" value="RETRAIT">`. Ajouter dans le moteur un matcher heuristique qui privilégie les `input[type=submit][value*=RETRAIT]` quand le step contient le mot "retrait" / "télécharger".

## Fichiers touchés

- **`supabase/functions/fetch-dce-agent/index.ts`** :
  - Nouveau handler `act_if_present`
  - Lecture flag `continue_on_error` sur playbook → wrap try/catch autour de la boucle steps
  - Helpers DOM : parcours iframes same-origin dans `wait_for_inputs` + `fill_anonymous_identity`
  - Heuristique input[type=submit] prioritaire pour `click_if_present`/`act` quand mots-clés "retrait/télécharger/valider"
  
- **Migration SQL** :
  - `UPDATE agent_playbooks SET steps = ..., config = '{"continue_on_error": true}' WHERE platform IN ('mpi', 'generic')`
  - Remplacer les `act` bloquants par `act_if_present`
  - Ajouter colonne `config jsonb DEFAULT '{}'` à `agent_playbooks` si absente

## Test après fix

Relancer sur la même URL Dordogne (`IDM=1808436`). Attendu :
- `click_if_present("RETRAIT")` matche directement l'input submit
- Si captcha présent → `solve_image_captcha_if_present` (déjà en place)
- `wait_download` récupère le ZIP

