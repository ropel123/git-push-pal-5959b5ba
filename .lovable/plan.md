

## Diagnostic

Les playbooks Maximilien / Megalis / Marchés-Sécurisés ont été seedés avec `requires_auth=true`, ce qui impose un compte dans `platform_robots`. En réalité, ces plateformes acceptent un retrait **anonyme** via un mini-formulaire (email + raison sociale + nom). Seul un sous-ensemble de DCE (procédures restreintes, pièces sensibles) exige un compte.

## Plan : passer en mode "identité anonyme" par défaut + fallback compte robot

### 1. Ajout d'un nouveau type d'action `fill_anonymous_identity`

Dans `supabase/functions/fetch-dce-agent/index.ts`, ajouter un handler pour `fill_anonymous_identity` qui :
- Lit une identité par défaut depuis une nouvelle table `agent_anonymous_identity` (ou un secret `AGENT_DEFAULT_IDENTITY` JSON)
- Pilote Stagehand : remplit email, raison sociale, nom, prénom, téléphone, SIRET dans le formulaire de retrait DCE
- N'échoue pas si certains champs n'existent pas

### 2. Migration SQL — table `agent_anonymous_identity`

Une table simple (1 ligne admin) avec : `email`, `company_name`, `siret`, `last_name`, `first_name`, `phone`. RLS admin only. Seed avec une identité par défaut Hackify.

### 3. Migration SQL — mise à jour des playbooks existants

`UPDATE agent_playbooks SET requires_auth=false` pour `maximilien`, `megalis`, `marches_securises`, `atexo`. Remplacer dans leurs `steps` l'action `fill_login` par `fill_anonymous_identity`. Garder un fallback : si le formulaire détecte un champ login/password, basculer sur `fill_login` (qui lui retombe sur `platform_robots`, sinon skip).

### 4. Logique côté agent (`fetch-dce-agent`)

Modifier la condition de blocage :
- Avant : `if (playbook.requires_auth && !robot) return error`
- Après : ne plus bloquer en amont. Laisser l'agent tenter `fill_anonymous_identity` d'abord. Si à un moment Stagehand détecte explicitement un écran de login (heuristique : champ password visible) ET qu'aucun robot n'existe, alors logger une trace `auth.required` et terminer proprement avec un message clair.

### 5. UI — onglet "Identité anonyme" dans AgentMonitor

Ajouter un 4e (ou 5e) onglet `Identité` dans `src/pages/AgentMonitor.tsx` permettant à l'admin d'éditer l'identité anonyme utilisée par défaut (formulaire simple : email, raison sociale, SIRET, nom, prénom, téléphone).

## Fichiers touchés

- Nouvelle migration SQL : créer `agent_anonymous_identity` + UPDATE playbooks
- `supabase/functions/fetch-dce-agent/index.ts` : handler `fill_anonymous_identity` + assouplir le check `requires_auth`
- `src/pages/AgentMonitor.tsx` : onglet Identité

## Note

Les comptes robots (`platform_robots`) restent utiles pour les rares plateformes qui exigent vraiment un login (consultations restreintes). Ils servent désormais de **fallback**, pas de prérequis.

