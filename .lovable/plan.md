

# Audit UI complet — Corrections des dimensions et du scroll

## Problèmes identifiés

### 1. Layout principal sans contrainte de hauteur
`AppLayout.tsx` : le `SidebarInset` n'a pas de `h-screen` ni `overflow-hidden`. Le contenu déborde et crée un scroll sur le `body` entier (sidebar + contenu scrollent ensemble). C'est la cause principale du "scroll dans tous les sens".

### 2. Zone de contenu sans scroll isolé
Le `div.flex-1.p-3` qui entoure `<Outlet />` n'a pas `overflow-y-auto`. Résultat : le scroll est global au lieu d'être limité à la zone de contenu (la sidebar devrait rester fixe).

### 3. Pipeline : 6 colonnes forcées sur xl
`Pipeline.tsx` utilise `xl:grid-cols-6` pour 6 étapes. Sur un écran 1311px (ton viewport), ça crée un scroll horizontal. Les colonnes sont trop étroites pour être lisibles.

### 4. Tenders : titres tronqués / débordent
Les titres d'AO débordent de leur carte (visible sur la capture). `truncate` est utilisé mais le conteneur n'a pas de `max-w` ou `overflow-hidden` effectif.

### 5. TenderDetail / Settings : `max-w-4xl` sans centrage
Les pages détail et paramètres utilisent `max-w-4xl` mais sans `mx-auto`, donc le contenu colle à gauche sur grand écran.

### 6. Settings : onglets trop serrés sur mobile
`grid-cols-4` pour les tabs même en mobile → texte coupé.

---

## Corrections prévues

### A. Layout principal (`AppLayout.tsx`)
- Ajouter `h-screen overflow-hidden` sur le wrapper `SidebarProvider`
- Ajouter `h-full flex flex-col overflow-hidden` sur `SidebarInset`
- Ajouter `overflow-y-auto` sur le conteneur de `<Outlet />` → scroll uniquement dans la zone de contenu, sidebar fixe

### B. Pipeline (`Pipeline.tsx`)
- Changer `xl:grid-cols-6` → `lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6`
- Ajouter un scroll horizontal propre avec `overflow-x-auto` en fallback
- Réduire `min-h-[200px]` → `min-h-[120px]`

### C. Tenders (`Tenders.tsx`)
- Ajouter `overflow-hidden` sur le conteneur de titre dans chaque carte
- Limiter la largeur avec `max-w-full` sur le `h3`

### D. TenderDetail (`TenderDetail.tsx`)
- Ajouter `mx-auto` au `max-w-4xl` existant

### E. Settings (`SettingsPage.tsx`)
- Ajouter `mx-auto` au `max-w-4xl` existant
- Tabs : passer de `grid-cols-4` fixe à responsive `grid-cols-2 sm:grid-cols-4`

### F. Dashboard (`Dashboard.tsx`)
- Ajouter `max-w-7xl mx-auto` pour centrer sur grands écrans

### G. Awards (`Awards.tsx`)
- Ajouter `max-w-5xl mx-auto` pour centrer

---

## Fichiers modifiés
- `src/components/AppLayout.tsx` — fix layout principal (scroll isolé)
- `src/pages/Pipeline.tsx` — grille responsive
- `src/pages/Tenders.tsx` — overflow titres
- `src/pages/TenderDetail.tsx` — centrage
- `src/pages/SettingsPage.tsx` — centrage + tabs responsive
- `src/pages/Dashboard.tsx` — centrage
- `src/pages/Awards.tsx` — centrage

## Résultat attendu
- La sidebar reste toujours visible et fixe
- Seul le contenu principal scrolle verticalement
- Plus de scroll horizontal involontaire
- Les titres ne débordent plus
- Le contenu est centré sur grands écrans

