

L'utilisateur a testé une URL Maximilien mais aucun playbook n'existe pour cette plateforme. J'ai seedé seulement PLACE et Atexo. Maximilien tourne sur la techno Atexo donc je peux réutiliser des étapes similaires.

## Plan : ajouter playbooks Maximilien + Megalis + Marchés-Sécurisés

### 1. Migration SQL — seed 3 playbooks supplémentaires

Insérer dans `agent_playbooks` :

- **maximilien** (`maximilien.fr`) — basé sur Atexo, requires_auth=true, requires_captcha=true. Étapes : goto, click "Télécharger le DCE", fill_login (si formulaire détecté), solve_captcha_if_present, accept CGU, wait_download.
- **megalis** (`megalis.bretagne.bzh`) — Atexo également, mêmes étapes.
- **marches_securises** (`marches-securises.fr`) — requires_auth=true, captcha optionnel. Étapes : goto, click "Retrait DCE", fill_login, solve_captcha_if_present, accept conditions, wait_download.

### 2. Améliorer le message d'erreur (optionnel)

Dans `fetch-dce-agent/index.ts`, le message actuel renvoie déjà "Créez-en un dans /agent-monitor". Pas de changement nécessaire — mais je vais m'assurer que l'onglet Playbooks de `/agent-monitor` permet bien de créer/éditer un playbook à la volée (à vérifier après lecture).

### 3. Vérifier l'onglet Playbooks dans AgentMonitor

Lire `src/pages/AgentMonitor.tsx` pour confirmer qu'il y a un éditeur visuel des steps. Si non présent, ajouter un bouton "Nouveau playbook" avec dialog (platform + display_name + url_pattern + JSON steps + toggles auth/captcha).

## Fichiers touchés

- Nouvelle migration SQL — 3 INSERT dans `agent_playbooks`
- `src/pages/AgentMonitor.tsx` — ajout dialog création/édition playbook si absent

## Note sur le flow

Pour les comptes Maximilien/Megalis/MS, l'utilisateur devra ensuite ajouter manuellement un compte robot dans l'onglet "Comptes robots" avant que les runs ne réussissent. Sinon le playbook échouera à `fill_login`.

