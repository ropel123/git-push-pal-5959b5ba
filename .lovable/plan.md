## Plan v3.3 Atexo — Pagination input-driven (fix DOM stuck)

### 🐛 Diagnostic confirmé

Sur la dernière run :
```
LIST: 10 IDs from HTML, totalPages=4
ACTIONS page 2: 10 IDs visible, +0 new   ← MÊMES IDs que page 1
ACTIONS page 3: 10 IDs visible, +0 new   ← MÊMES IDs encore
```

Le click "page suivante" déclenche un postback AJAX ASP.NET, mais **Firecrawl capture le DOM avant le refresh complet** (ou le DOM est replace identique). Le bouton click est fragile sur ce type de site stateful.

**Solution** : passer en pagination **input-driven** — remplir directement le champ `numPageBottom` avec le numéro de page cible et soumettre. C'est la vraie API "backend" d'Atexo.

### 🔧 Changements (1 seul fichier)

`supabase/functions/_shared/atexoExecutor.ts` :

1. **Nouvelle fonction `buildInputDrivenActions(targetPage)`** :
   ```ts
   [
     { type: "wait", milliseconds: 1200 },
     { type: "click", selector: "input[name*='numPageBottom']" },
     { type: "press", key: "Backspace" }, // x3 pour effacer "1"/"10"/"100"
     { type: "press", key: "Backspace" },
     { type: "press", key: "Backspace" },
     { type: "write", text: String(targetPage) },
     { type: "wait", milliseconds: 300 },
     { type: "click", selector: "input[name*='DefaultButtonBottom']" }, // submit hidden d'Atexo
     { type: "wait", milliseconds: 2500 },
     { type: "scrape" }
   ]
   ```
   → Pourquoi click sur le bouton submit caché plutôt que `press Enter` ? Bug connu Firecrawl ([issue #705](https://github.com/mendableai/firecrawl/issues/705)) : `press Enter` ne déclenche pas toujours le submit. Atexo expose un `<input type="submit" id="...DefaultButtonBottom" style="display: none">` parfait pour ça.

2. **Garde `buildClickNextActions()` en fallback** :
   - Si la 1ère tentative input-driven échoue (input absent / submit indisponible) → on bascule sur l'ancien click-next pour cette URL et les suivantes.

3. **Auto-détection DOM stuck** :
   - Si page N renvoie exactement les mêmes IDs que page N-1 → on log `AJAX_NOT_REFRESHING_DOM` dans les stats et on stoppe (au lieu de gaspiller du budget).

4. **Stats enrichies** :
   ```ts
   stats: {
     ...,
     pagination_mode: "input" | "click_fallback",
     dom_stuck_detected: boolean
   }
   ```

### 🎯 Résultat attendu

Sur le cas `portail.marchespublics.nc` (4 pages × 10) :
- Avant : 10 items, stopped=no_new_items
- Après : **35-40 items** (toutes pages réelles)
- Calls Firecrawl : **5** (1 list + 4 actions)
- Coût estimé : ~$0.05

### ⚠️ Garde-fous conservés
- Max 5 calls par URL Atexo
- Stop après 2 pages consécutives sans nouveaux IDs
- Continue avec les IDs déjà collectés si une page action plante (pas de fail global)

### 📦 Pas de migration BDD, pas de nouveau fichier

Modification ciblée d'un seul module existant.
