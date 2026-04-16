

L'utilisateur a uploadé une capture de la doc 2Captcha API v2 sans message. Il me montre qu'il est sur la bonne page mais cherche probablement où récupérer sa clé API. La capture montre la doc technique, pas le dashboard.

## Tu es sur la doc, pas sur ton compte

La page que tu vois (`2captcha.com/api-docs/...`) c'est la **documentation technique**. Pour récupérer ta clé, il faut aller dans ton **espace personnel**.

### Étape 1 — Connecte-toi (si pas déjà fait)

- En haut à droite de la page, clique sur **"Sign in"** (ou "Sign up" si tu n'as pas encore de compte)
- Choisis bien le rôle **"Customer"** à l'inscription (pas "Worker")

### Étape 2 — Récupère ta clé API

Une fois connecté, tu arrives sur ton dashboard. Cherche :
- Menu de gauche : **"API Settings"** ou directement **"Dashboard"**
- Tu verras un bloc **"Your API key"** avec une chaîne de ~32 caractères
- URL directe une fois loggé : `https://2captcha.com/setting`

### Étape 3 — Recharge ton compte (obligatoire)

- Menu de gauche : **"Add funds"**
- Recharge **5 €** minimum (PayPal ou CB)
- Sans crédit, les captchas échouent silencieusement → l'agent ne marchera pas

## Récap des 3 valeurs à me donner

| Secret | Où | Format attendu |
|---|---|---|
| `BROWSERBASE_API_KEY` | Browserbase Settings (déjà vu) | `bb_live_Xrw...` |
| `BROWSERBASE_PROJECT_ID` | Browserbase Settings (déjà vu) | `5698db44-ec14-...` |
| `TWOCAPTCHA_API_KEY` | 2Captcha → setting | 32 caractères alphanumériques |

## Quand c'est prêt

Réponds-moi simplement **« j'ai les 3 clés »** et je relance la demande de stockage sécurisé. Un formulaire apparaîtra dans Lovable avec 3 champs où tu colleras les valeurs (chiffrées côté Supabase, jamais visibles dans le code).

Ensuite je construirai immédiatement :
1. La edge function `fetch-dce-agent` (orchestrateur Browserbase + Stagehand + 2Captcha)
2. Le bouton « Récupération automatique IA » dans `TenderDetail.tsx`
3. La page admin `/agent-monitor` pour voir les runs en temps réel

