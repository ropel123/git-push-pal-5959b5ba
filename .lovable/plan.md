

L'utilisateur demande si on peut construire un agent IA navigateur capable de gérer captchas, login, et téléchargement DCE sur les ~32 plateformes sans API. Réponse: oui, c'est faisable. Voici le plan.

## Agent IA navigateur pour récupération DCE (avec captcha)

### Approche technique

Combinaison de **3 services spécialisés** orchestrés depuis une edge function:

1. **Browserbase** (ou Browserless) — navigateur Chrome headless cloud, résidentiel, avec session persistante (cookies/login conservés entre runs)
2. **Stagehand** (de Browserbase) ou **Playwright + LLM** — pilotage en langage naturel ("clique sur Télécharger le DCE", "remplis le captcha")
3. **2Captcha / CapSolver** — résolution automatique des captchas (reCAPTCHA v2/v3, hCaptcha, image, audio)

### Architecture

```text
┌────────────────────────────────────────────────┐
│  fetch-dce-agent (nouvelle edge function)      │
│  Reçoit: tender_id + dce_url                   │
└────────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────┐
│  1. Routeur                                    │
│     URL → adaptateur (api / firecrawl / agent) │
└────────────────────────────────────────────────┘
            │ (si plateforme avec auth/captcha)
            ▼
┌────────────────────────────────────────────────┐
│  2. Browserbase                                │
│     - Ouvre session persistante (1/plateforme) │
│     - Stagehand pilote via instructions LLM    │
│     - Si captcha détecté → 2Captcha            │
│     - Login avec credentials chiffrés en DB    │
│     - Navigue vers DCE → clique Télécharger    │
└────────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────┐
│  3. Récupère ZIP/PDF → Supabase Storage        │
│     Update tender + dce_uploads                │
└────────────────────────────────────────────────┘
```

### Ce qui sera construit

1. **Tables DB**:
   - `platform_robots` — credentials chiffrés (login/password) par plateforme, comptes "robots" créés une fois
   - `agent_runs` — log de chaque exécution (succès, durée, captchas résolus, coût)
   - `agent_playbooks` — instructions LLM par plateforme (ex: "Atexo: cliquer Consulter > accepter CGU > Télécharger DCE")

2. **Edge function `fetch-dce-agent`**:
   - Reçoit `tender_id` + `dce_url`
   - Détecte plateforme, charge playbook + credentials
   - Lance session Browserbase
   - Stagehand exécute les étapes en langage naturel
   - Captcha auto-résolu via 2Captcha
   - Upload fichiers vers `dce-documents` bucket

3. **Page admin `/agent-monitor`**:
   - Voir runs en temps réel (succès/échec/coût)
   - Tester un playbook sur une URL
   - Éditer les playbooks par plateforme
   - Gérer les comptes robots

4. **Job cron `agent-batch`** — traite les tenders sans DCE en file d'attente, 1/min pour ne pas se faire bannir

### Coûts estimés

- Browserbase: ~$0.10/session (5 min moyenne)
- 2Captcha: ~$0.001/captcha simple, ~$0.003/reCAPTCHA
- Lovable AI Gateway (Stagehand): ~$0.01/run
- **Total: ~$0.15 par DCE récupéré**

### Pré-requis (clés API à fournir)

- `BROWSERBASE_API_KEY` + `BROWSERBASE_PROJECT_ID` → https://browserbase.com
- `TWOCAPTCHA_API_KEY` → https://2captcha.com
- (Lovable AI Gateway déjà connecté ✅)

### Limites légales à connaître

- **CGU des plateformes**: la plupart interdisent le scraping. Risque de bannissement IP/compte. Browserbase utilise des IPs résidentielles tournantes pour limiter ça.
- **Captcha = signal "humain requis"**: contourner peut violer le Computer Fraud and Abuse Act dans certains cas. En France, c'est une zone grise tant que les données sont publiques (DCE = doc public par nature).
- **Recommandation**: créer 1 compte "Hackify Bot" par plateforme avec mention explicite dans le profil ("Agent automatisé pour récupération DCE") + respecter robots.txt + rate limit 1 req/min.

### Phasage proposé

- **Phase 1** (1 semaine): Browserbase + Stagehand + adaptateur Atexo (achatpublic + local-trust = ~40 instances couvertes)
- **Phase 2**: Ajout 2Captcha + adaptateurs Maximilien, Marches-Sécurisés, Omnikles
- **Phase 3**: Adaptateurs B2B fermés (BravoSolution, Ariba) si comptes utilisateur fournis

