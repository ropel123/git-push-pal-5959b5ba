

## Diagnostic confirmé

`supabase/functions/fetch-dce-agent/index.ts` importe (directement ou indirectement) `playwright-core` / `@browserbasehq/stagehand`, qui requièrent :
- Un filesystem local pour le "browser registry" Playwright (absent dans Deno Deploy edge runtime)
- Les modules natifs `bufferutil` et `utf-8-validate` (non résolvables)

Résultat : crash au boot → preflight OPTIONS sans réponse → CORS error côté client. Aucun playbook ni identité anonyme n'est en cause.

## Plan : remplacer Stagehand/Playwright par le SDK Browserbase HTTP + CDP via WebSocket Deno-native

### Option retenue : Browserbase Sessions API + Chrome DevTools Protocol

Browserbase expose une API REST pour créer une session distante, et renvoie une URL `wss://…` (Chrome DevTools Protocol). On pilote le navigateur **distant** via CDP brut depuis Deno, sans Playwright local. C'est exactement l'usage prévu pour les runtimes serverless contraints.

### 1. Réécrire `supabase/functions/fetch-dce-agent/index.ts`

Remplacer toute la couche Stagehand/Playwright par :

- **Création de session** : `POST https://api.browserbase.com/v1/sessions` avec `BROWSERBASE_API_KEY` + `BROWSERBASE_PROJECT_ID` → récupère `id`, `connectUrl` (wss CDP), `signingKey`
- **Connexion CDP** : `new WebSocket(connectUrl)` (natif Deno) + petit client CDP minimal (envoi/réception JSON-RPC, ids incrémentaux, promesses par id)
- **Helpers de haut niveau** basés sur CDP commands :
  - `Page.navigate({url})` pour `goto`
  - `Runtime.evaluate({expression})` pour cliquer/remplir via JS injecté (`document.querySelector(...).click()`, `setNativeValue` + `dispatchEvent('input')`)
  - `Network.enable` + écoute `Network.responseReceived` pour détecter les téléchargements de PDF/ZIP
  - `Page.printToPDF` ou `Browser.downloadProgress` pour récupérer les fichiers
- **Capture des fichiers** : pour les téléchargements binaires, intercepter via `Fetch.enable` + `Fetch.getResponseBody` (base64), puis upload dans le bucket `dce-documents`

### 2. Remplacer "natural language actions" par heuristiques DOM

Stagehand gérait les `act/instruction` en LLM-vision. On remplace par :
- Pour `click`/`act` : injection JS qui scanne tous les `a`, `button`, `input[type=submit]` dont le texte contient un des libellés du `instruction` (split sur virgules + parenthèses) → click sur le premier match visible
- Pour `fill_anonymous_identity` : JS qui mappe les `input`/`textarea`/`select` par labels/placeholders/names connus (`email`, `mail`, `raison sociale`, `société`, `nom`, `prénom`, `téléphone`, `siret`) → remplit avec l'identité par défaut
- Pour `solve_captcha_if_present` : détection `iframe[src*="recaptcha"]` ou `[data-sitekey]` → appel 2Captcha API HTTP (`TWOCAPTCHA_API_KEY` déjà présent) → injection du token dans `g-recaptcha-response` + dispatch event
- Pour `click_if_present` : même heuristique que `click` mais ne fail pas si rien trouvé

C'est moins "intelligent" qu'un LLM mais 100% serverless-compatible et déterministe.

### 3. Tracing & coût

Conserver la trace step-by-step (déjà branchée sur `agent_runs.trace`). Calculer `cost_usd` à partir de la durée Browserbase (≈ 0,10 $ / minute) + 0,003 $ par captcha 2Captcha.

### 4. CORS & boot defensive

Wrapper tout le handler dans un `try/catch` global avec headers CORS sur la réponse d'erreur, pour qu'un futur crash de boot ne casse plus la preflight.

## Fichiers touchés

- `supabase/functions/fetch-dce-agent/index.ts` — réécriture complète (~400 lignes), suppression imports `playwright-core` / `stagehand`
- Aucune migration SQL : les playbooks et l'identité anonyme restent valides

## Limitations honnêtes

- Plateformes ultra-dynamiques (SPA React lourdes type Atexo récents) peuvent demander des sélecteurs spécifiques → ajustables playbook par playbook
- Pas de "vision LLM" → si le DOM change radicalement on devra mettre à jour les heuristiques. Acceptable pour PLACE/Maximilien/Megalis qui sont stables

