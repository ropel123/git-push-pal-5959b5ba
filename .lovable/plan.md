

## Diagnostic

L'agent va maintenant **jusqu'au bout sans crasher** ✅ mais le téléchargement échoue : `wait_download` 25s → `storage.upload aucune archive`. Trois symptômes clés dans la trace :

1. **`fill_anonymous_identity` → "aucun input visible"** alors que `choixAnonyme` (un radio button ASP.NET WebForms `ctl0$CONTENU_PAGE$EntrepriseFormulaireDemande$choixAnonyme`) vient juste d'être cliqué. Sur Maximilien (PLACE/Atexo legacy), cocher la radio **ne déclenche pas** l'apparition immédiate des champs : il faut un **postback ASP.NET** (soit la radio elle-même déclenche `__doPostBack`, soit il y a un bouton "Continuer" intermédiaire). Notre `wait 1500ms` n'attend pas ce postback.

2. **`click_if_present("Coche CGU") → top5: a "Aller au menu" / "Se connecter" / "Avis"`** → le snapshot top5 montre des liens **du header global** de la page, pas des éléments du formulaire. Ça confirme : on est resté **sur la page d'accueil** du formulaire (radio sélectionnée) sans avoir progressé vers l'étape "remplir les champs".

3. **`Valider` cliqué (heuristic) → no download** : le `Valider` cliqué est probablement un bouton décoratif/inactif (formulaire incomplet → submit silencieusement rejeté côté client). L'heuristique a pris le premier "Valider" venu.

## Plan : gérer les postbacks ASP.NET + meilleur flow Maximilien

### 1. Ajouter une action `wait_for_inputs` dans le moteur

Nouveau type d'action qui **attend qu'au moins N inputs visibles apparaissent** dans le DOM (polling 500ms, timeout configurable). Indispensable pour les SPA / postbacks lents.

```ts
case "wait_for_inputs": {
  const start = Date.now();
  while (Date.now() - start < (step.timeout_ms ?? 8000)) {
    const count = await jsCountVisibleInputs(cdp);
    if (count >= (step.min ?? 1)) { logOk(...); break; }
    await sleep(500);
  }
}
```

### 2. Améliorer `fill_anonymous_identity` : déclencher les events ASP.NET après chaque fill

Sur ASP.NET WebForms, après `setNativeValue` il faut dispatch `change` + `blur` (déjà fait) **mais aussi** parfois `__doPostBack` côté navigateur. Élargir aussi les sélecteurs d'inputs pour matcher `input[type="text"]:not([type="hidden"])` même sans `name="email"` explicite, et utiliser le LLM pour mapper inputs ↔ champs identité **systématiquement** (pas seulement en fallback) sur les plateformes complexes.

### 3. Améliorer la sélection du bouton final "Valider"

Le `click_if_present("Valider")` heuristique a cliqué un bouton qui n'a rien fait. Préférer la **stratégie LLM-first** pour le bouton final, avec instruction enrichie :
> "Bouton SUBMIT du formulaire de retrait DCE : généralement un `<input type='submit'>` ou `<button type='submit'>` avec texte Valider/Télécharger/Confirmer. PAS un bouton de navigation, PAS un bouton 'Annuler', PAS un onglet."

Et ajouter une **vérification post-clic** : si le formulaire n'a pas changé d'URL ni déclenché de download après 5s, retry avec un autre candidat.

### 4. Mise à jour du playbook Maximilien

```diff
  {"action":"click_if_present","instruction":"Option Retrait anonyme..."},
- {"action":"wait","timeout_ms":1500},
+ {"action":"wait","timeout_ms":2500},
+ {"action":"click_if_present","instruction":"Bouton Continuer / Suivant / Valider le choix anonyme (étape intermédiaire après sélection du mode)"},
+ {"action":"wait_for_inputs","min":2,"timeout_ms":8000},
  {"action":"fill_anonymous_identity"},
- {"action":"wait","timeout_ms":1500},
+ {"action":"wait","timeout_ms":2000},
  {"action":"solve_captcha_if_present"},
  {"action":"click_if_present","instruction":"Coche la case d'acceptation des CGU..."},
- {"action":"click_if_present","instruction":"Bouton de validation finale..."},
+ {"action":"act","instruction":"Bouton SUBMIT final du formulaire de retrait : input[type=submit] ou button[type=submit] avec texte Valider/Télécharger/Confirmer/Envoyer. PAS un bouton Annuler ni un onglet de menu"},
  {"action":"wait_download","timeout_ms":30000}
```

Repasser le bouton final en `act` (strict + LLM-first), pas `click_if_present`, parce que sans ce clic il n'y a **aucune** chance de download. Mieux vaut échouer explicitement que silencieusement.

### 5. Logger l'URL courante dans la trace

Avant chaque step `act`/`fill`/`click_if_present`, enregistrer `document.location.href` dans la trace. Ça permet de voir **si on a bien changé de page** entre les étapes (debug critique pour les postbacks ASP.NET).

## Fichiers touchés

- **`supabase/functions/fetch-dce-agent/index.ts`** :
  - Nouvelle action `wait_for_inputs` (~15 lignes)
  - `jsFillIdentity` : LLM-first pour identités complexes (toggle via param ou auto-detect plateforme)
  - Vérification post-submit (URL changed OR download started) (~20 lignes)
  - Log de `document.location.href` à chaque step interactif (~5 lignes)
- **Migration SQL** : `UPDATE agent_playbooks SET steps = ... WHERE platform = 'maximilien'` avec le nouveau flow ci-dessus

## Note honnête

Maximilien (basé sur Atexo / PLACE legacy ASP.NET WebForms) est l'une des plateformes les plus pénibles de France : postbacks invisibles, `ViewState` lourd, multi-étapes. C'est précisément le cas d'usage où l'**adaptabilité LLM** vaut son coût. Une fois ce playbook stable, BOAMP / TED / Megalis (qui sont plus modernes) seront triviales en comparaison.

