

Tu es au bon endroit. Je vois sur ta capture les 2 valeurs dont j'ai besoin :

## Tes 2 clés Browserbase (visibles à l'écran)

### 1. Project ID ✅
```
5698db44-ec14-4c3e-a752-aed1135a... (clique sur l'icône copier à droite pour avoir la valeur complète)
```

### 2. API Key ✅
```
bb_live_Xrw**************** (masquée — clique sur l'icône œil 👁 pour la révéler, puis sur l'icône copier 📋)
```

## Ce que tu fais maintenant

1. **Copie le Project ID** : clique sur l'icône 📋 à droite de `5698db44-ec14-4c3e-a752-aed1135a...`
2. **Révèle puis copie l'API Key** : clique sur 👁 pour afficher la clé complète, puis 📋 pour la copier
3. **Garde les 2 valeurs de côté** (dans un bloc-notes par exemple)

## En parallèle : 2Captcha (3 min)

Pendant que tu y es, ouvre un autre onglet :
1. https://2captcha.com → **Sign up**
2. Une fois connecté, va dans **Settings → API Key** (en haut à droite)
3. Recharge **5€ minimum** via "Add funds" (sinon les captchas échouent silencieusement)
4. Copie la clé API

## Ensuite

Réponds-moi simplement **"j'ai les 3 clés"** et je relancerai la demande de secrets dans Lovable. Un formulaire sécurisé apparaîtra où tu colleras :
- `BROWSERBASE_API_KEY` → la clé `bb_live_...`
- `BROWSERBASE_PROJECT_ID` → `5698db44-...`
- `TWOCAPTCHA_API_KEY` → la clé 2Captcha

Les valeurs seront chiffrées côté Supabase, jamais visibles dans le code, et accessibles uniquement par les edge functions.

Puis je construirai la edge function `fetch-dce-agent` qui fera le travail réel de récupération automatisée des DCE.

