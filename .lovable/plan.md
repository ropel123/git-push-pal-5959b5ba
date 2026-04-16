

## Diagnostic

La trace est éloquente :
1. ✅ `act("Clique sur le bouton télécharger DCE")` → trouve un lien intitulé " Publicité / Téléchargement" — c'est probablement **un onglet de navigation**, pas le bouton de retrait DCE
2. ⚠️ `fill_anonymous_identity` → `champs: ` (vide !) → aucun input mappé. Soit la modale de retrait n'est pas ouverte, soit Maximilien utilise des composants Angular/PrimeNG (`<p-inputtext>`, divs contenteditable) que mes sélecteurs `input/textarea` ratent
3. ❌ `act("Valide le formulaire pour lancer le téléchargement")` → aucun bouton trouvé → **fail**

Les heuristiques DOM sont trop pauvres pour les SPA modernes. Plutôt que d'ajuster manuellement chaque sélecteur (fragile, sans fin), il faut donner à l'agent **un peu de "vision LLM"** sur le DOM courant pour qu'il choisisse le bon élément.

## Plan : ajouter un fallback LLM "smart click" via Lovable AI Gateway

### 1. Nouvelle fonction `smartActWithLLM(cdp, instruction)` dans `fetch-dce-agent`

Quand l'heuristique `jsClickByText` échoue :
1. Extraire un **snapshot léger du DOM** via `Runtime.evaluate` : tous les éléments cliquables visibles avec leur texte, `tagName`, `id`, `aria-label`, et un index numéroté → ~50-200 candidats, sérialisés en JSON compact
2. Envoyer à `https://ai.gateway.lovable.dev/v1/chat/completions` (modèle `google/gemini-2.5-flash`, gratuit) avec un prompt système : *"Tu es un agent d'automatisation web. Voici les éléments cliquables visibles. Retourne UNIQUEMENT l'index de l'élément qui correspond le mieux à : `<instruction>`. Si aucun ne correspond, retourne `-1`."*
3. Récupérer l'index → cliquer via `Runtime.evaluate` (`document.querySelectorAll(...)[idx].click()`)

Coût : ~0.0001 $ par appel LLM, négligeable. Latence : ~500ms.

### 2. Idem pour `fill_anonymous_identity` quand `champs:` est vide

Snapshot des inputs visibles avec leurs labels/placeholders → demander au LLM de retourner un mapping `{ index: champ_identité }` (email, company_name, …) → remplir via `setNativeValue`.

### 3. Élargir les heuristiques DOM (avant même de tomber sur le LLM)

- Ajouter `[role="textbox"]`, `[contenteditable="true"]`, `p-inputtext input`, `mat-form-field input` dans les sélecteurs d'inputs
- Ajouter `[mat-button], [mat-raised-button], .ui-button, .p-button` dans les sélecteurs cliquables  
- Pour les boutons "submit"/"valider", ajouter détection par `type=submit` + texte court (Valider, OK, Confirmer, Envoyer, Télécharger)

### 4. Stratégie d'ordre

```
1. heuristique DOM rapide (gratuit, 50ms)
   └─ si match → click & log "ok (heuristic)"
   └─ sinon → fallback LLM (500ms, ~0.0001$)
        └─ si match → click & log "ok (llm)"
        └─ sinon → fail si "act", skip si "click_if_present"
```

Le LLM ne tourne **que si** l'heuristique échoue. Sur PLACE et BOAMP qui sont stables, on n'appellera jamais le LLM.

### 5. Mise à jour du playbook Maximilien

Le step `act("Clique sur le bouton ou lien permettant de télécharger le DCE")` matche actuellement " Publicité / Téléchargement" qui est un **onglet menu**, pas le CTA. Reformuler en : `"Clique sur le bouton 'Télécharger le DCE' ou 'Retrait du dossier' (pas l'onglet de menu)"`. Le LLM saura alors discriminer.

## Fichiers touchés

- `supabase/functions/fetch-dce-agent/index.ts` : 
  - élargir `jsClickByText` et `jsFillIdentity` (sélecteurs Angular/PrimeNG)
  - ajouter `smartActWithLLM` + `smartFillWithLLM` utilisant `LOVABLE_API_KEY`
  - brancher en fallback dans le switch `act/click/fill_anonymous_identity`
- Migration SQL légère : `UPDATE agent_playbooks SET steps = ...` pour reformuler 1-2 instructions Maximilien

## Note honnête

Sans ce fallback LLM, on devra écrire un playbook spécifique avec sélecteurs CSS exacts pour CHAQUE plateforme (PLACE, Atexo, Maximilien, Megalis, MS = 5 playbooks, 30+ heures de R&D). Le LLM rend l'agent **adaptatif** : un seul playbook générique fonctionne sur toutes les plateformes au prix de ~0.001 $ de plus par run.

