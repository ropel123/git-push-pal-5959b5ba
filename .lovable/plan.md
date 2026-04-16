

## Plan : automatisation réelle du navigateur avec Stagehand + 2Captcha

### 1. Remplacer le stub Browserbase par Stagehand
Dans `supabase/functions/fetch-dce-agent/index.ts` :
- Importer `@browserbasehq/stagehand` via esm.sh
- Créer une vraie session Browserbase, attacher Stagehand
- Pour chaque étape du playbook, utiliser les méthodes en langage naturel `page.act()` / `page.observe()` / `page.extract()` pour exécuter (`goto`, `click`, `fill`, `wait`, `solve_captcha`, `download`)
- Injecter les identifiants robot depuis `platform_robots` quand `requires_auth=true`
- Détecter les captchas (sitekey reCAPTCHA v2 via DOM observe), appeler l'API 2Captcha, injecter le token via `g-recaptcha-response`
- Capturer les téléchargements via l'API Browserbase → upload vers le bucket `dce-documents`
- Streamer une `trace` structurée (statut par étape, URLs screenshots, timing) dans `agent_runs.trace`

### 2. Initialiser 2 playbooks de démarrage
Insertion via migration dans `agent_playbooks` :
- **PLACE (marches-publics.gouv.fr)** — public, sans captcha, liens de téléchargement directs
- **Atexo (famille achatpublic.com)** — auth requise, reCAPTCHA v2, multi-étapes accept-CGU → download

Chaque playbook = tableau JSON d'étapes type :
```json
[
  {"action":"goto","target":"{{dce_url}}"},
  {"action":"act","instruction":"clique sur le bouton 'Télécharger le DCE'"},
  {"action":"solve_captcha","type":"recaptcha_v2"},
  {"action":"act","instruction":"accepte les CGU et continue"},
  {"action":"download","timeout":60000}
]
```

### 3. Brancher l'UI trace dans AgentMonitor
Dans l'onglet Runs, rendre chaque ligne cliquable → panneau latéral affichant le tableau `trace` avec statut, durées et miniatures de screenshots (Browserbase expose les replays de session).

### 4. Verrou admin
Actuellement `/agent-monitor` est ouvert à tout utilisateur authentifié. Ajouter un garde : rediriger les non-admins (vérification `user_roles` pour `admin`) vers `/`. Idem pour `DceAgentFetchButton` — ne s'affiche que pour les admins tant que ce n'est pas stable.

## Notes techniques

- Stagehand sur Deno : `import { Stagehand } from "https://esm.sh/@browserbasehq/stagehand@1?bundle"` — mode env Browserbase (pas de Playwright local)
- 2Captcha : polling standard `in.php` / `res.php`, ~15-30s par reCAPTCHA v2
- Coût : Browserbase = 0,10 $/min de session, 2Captcha = ~0,003 $/captcha → écrit dans `agent_runs.cost_usd`
- Timeout : edge function plafonnée à 90s ; si dépassé, statut `timeout` et trace persistée
- La colonne `password_encrypted` stocke pour l'instant du clair → à durcir avec pgsodium (hors scope de cette étape)

## Hors scope de cette étape

- Chiffrement pgsodium des mots de passe robots (passe de durcissement séparée)
- Cron de traitement par lots (attend que Stagehand soit validé sur 1 run manuel)
- Adaptateurs pour toutes les plateformes (uniquement PLACE + Atexo pour valider l'architecture)

## Fichiers touchés

- `supabase/functions/fetch-dce-agent/index.ts` — réécriture complète de l'orchestrateur
- `src/pages/AgentMonitor.tsx` — lignes cliquables + panneau trace
- `src/components/DceAgentFetchButton.tsx` — affichage admin uniquement
- Nouvelle migration — seed des 2 playbooks + helper de garde de route admin si nécessaire

