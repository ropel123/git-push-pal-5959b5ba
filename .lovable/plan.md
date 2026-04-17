

## Diagnostic

L'agent reçoit une URL DCE qu'il ne sait pas mapper à une plateforme connue. `router.detect_platform` retourne `"unknown"` → aucun playbook actif → erreur fatale.

Causes probables :
1. URL testée non couverte par les regex/url_pattern dans `agent_playbooks` (ex: une URL PLACE alors que seul Maximilien a un playbook actif)
2. Logique de détection trop stricte (matche uniquement sur hostname exact)
3. Pas de fallback générique quand la détection échoue

## Investigation à mener (lecture seule en plan mode)

- `supabase/functions/fetch-dce-agent/index.ts` — fonction `detect_platform` + chargement playbooks
- Table `agent_playbooks` — quelles plateformes ont `is_active=true` et leurs `url_pattern`
- URL exacte qui a déclenché le run `3cc59589`

## Plan de correction

### 1. Améliorer `detect_platform` (router)
Trois niveaux en cascade :
1. Match `url_pattern` (regex) des playbooks actifs en base — comportement actuel
2. Si "unknown" : match heuristique par hostname connu (mapping en dur : `marches-publics.gouv.fr → place`, `maximilien.fr → maximilien`, `marches-publics.info → mpi`, `achatpublic.com → achatpublic`, `e-marchespublics.com → emarchespublics`, `marches-securises.fr → marches-securises`, `megalisbretagne.org → megalis`, `atexo` patterns, etc.)
3. Si toujours "unknown" : fallback sur un **playbook générique LLM-first** (`platform = "generic"`) qui laisse Claude piloter sans recette préalable — déjà le mode opératoire de fond de l'agent.

### 2. Créer un playbook "generic" en base
Migration SQL : insérer une ligne `agent_playbooks` avec `platform='generic'`, `url_pattern='.*'`, `display_name='Generic LLM-first'`, `is_active=true`, `steps` = séquence minimale (ouvrir URL → laisser act/extract LLM piloter → télécharger DCE).

### 3. Améliorer le message d'erreur côté UI
Si vraiment aucun playbook ne match, le toast doit indiquer l'URL et la plateforme détectée pour permettre à l'admin de créer/activer le playbook adapté en 1 clic depuis `/agent-monitor`.

### 4. (Bonus) Bouton "Créer playbook pour cette URL" dans `/agent-monitor`
Sur les runs `failed` avec erreur "Aucun playbook actif", un bouton qui pré-remplit un formulaire de création playbook avec l'URL et la plateforme suggérée.

## Fichiers touchés

- **Migration SQL** : insérer playbook `generic` (fallback universel)
- **`supabase/functions/fetch-dce-agent/index.ts`** : enrichir `detect_platform` (cascade regex DB → hostname map → generic fallback)
- **`src/pages/AgentMonitor.tsx`** (optionnel) : message d'erreur enrichi + bouton "Créer playbook"

## Étape d'investigation préalable

Avant d'implémenter, je dois lire `fetch-dce-agent/index.ts` (fonction `detect_platform` et chargement playbooks) et lister les playbooks actifs en base pour confirmer l'URL/pattern qui a foiré sur ce run précis. Une fois en mode édition, je commencerai par ça avant d'écrire le code.

