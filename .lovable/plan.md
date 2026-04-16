

## Diagnostic

Bonne nouvelle : le LLM fallback fonctionne — il a trouvé "Dossier de consultation - 1,59 Mo" (idx=19) sur l'étape précédente. Le problème actuel est un **step trop strict** :

```
act("Si une option Retrait anonyme ou Sans identification est proposée, clique dessus")
```

Sur Maximilien, après le clic sur "Dossier de consultation", on tombe **directement sur le formulaire de retrait anonyme** (pas de choix entre "anonyme/identifié" intermédiaire). L'étape `act` échoue parce qu'aucun bouton de ce type n'existe → il faut que ce step soit **optionnel** (`click_if_present` au lieu de `act`).

Par ailleurs, deux autres steps après risquent aussi d'échouer en cascade pour la même raison (étape obligatoire alors qu'elle pourrait ne pas exister selon la plateforme).

## Plan : rendre le playbook tolérant aux étapes optionnelles

### 1. Migration SQL : convertir les étapes "peut-être présentes" en `click_if_present`

Dans le playbook `maximilien`, transformer :

```diff
- {"action":"act","instruction":"Si une option Retrait anonyme ou Sans identification est proposée, clique dessus"}
+ {"action":"click_if_present","instruction":"Option Retrait anonyme, Sans identification, Accès libre, ou Téléchargement sans compte"}
```

Garder `act` (strict) **uniquement** pour les 2 étapes vraiment obligatoires :
- Le clic initial sur "Dossier de consultation" 
- Le bouton final de validation/téléchargement

### 2. Améliorer la robustesse du `act` final

Le step final `act("Clique sur le bouton de validation finale...")` peut aussi échouer si Maximilien déclenche un téléchargement direct (sans bouton de validation). Le rendre tolérant via une **stratégie en cascade** :

```json
{"action":"click_if_present","instruction":"Bouton Valider, Télécharger, Confirmer ou Envoyer le formulaire"},
{"action":"wait_download","timeout_ms":25000}
```

Si le bouton existe → on clique. Sinon → on attend quand même un download (cas où le clic précédent l'a déjà déclenché).

### 3. Côté edge function : aucune modif nécessaire

Le moteur gère déjà bien `click_if_present` (heuristique → LLM → skip si rien). Le problème est uniquement dans la définition du playbook.

### 4. (Optionnel) Logger les snapshots LLM

Quand un `click_if_present` ne matche rien après LLM, logger les 5 premiers candidats du snapshot dans `agent_runs.trace` pour faciliter le debug futur. Ça permet de comprendre **ce que voit l'agent** quand il échoue.

## Fichiers touchés

- **Migration SQL** : `UPDATE agent_playbooks SET steps = ... WHERE platform = 'maximilien'`
- **`supabase/functions/fetch-dce-agent/index.ts`** : ajouter le log des candidats top-5 dans la trace quand `click_if_present` est skip après LLM (10 lignes)

## Note

C'est un ajustement de **playbook**, pas de moteur. Le moteur LLM-fallback marche : il a trouvé le bon bouton sur l'étape précédente. Reste à enseigner au playbook que toutes les plateformes ne demandent pas le même nombre de clics intermédiaires.

