

## Plan : Fond sombre + boutons orange + styles manquants

Le site utilise des classes CSS utilitaires (`btn-primary`, `text-gradient-orange`, `section-padding`, `section-container`, `headline-lg`, `body-lg`, `font-display`) qui ne sont **jamais définies** dans `index.css` ni ailleurs. C'est pourquoi les boutons orange et le style global ne fonctionnent pas.

### Modifications

**1. `src/index.css`** — Remplacer les variables `:root` par un thème sombre et ajouter toutes les classes utilitaires manquantes :

- **Variables `:root`** : fond sombre (`0 0% 10%`), texte clair, primary orange (`24 95% 53%`), cards/borders/muted cohérents dark
- **Ajouter dans `@layer components`** :
  - `.btn-primary` : fond orange, texte blanc, hover, padding, rounded, transition, flex inline
  - `.text-gradient-orange` : gradient text orange via `background-clip: text`
  - `.section-padding` : padding vertical responsive
  - `.section-container` : max-width + padding horizontal centré
  - `.headline-lg` : taille de titre responsive
  - `.body-lg` : texte body large avec couleur muted

**2. `tailwind.config.ts`** — Ajouter `fontFamily.display` (ex: Inter/system sans-serif) pour que `font-display` fonctionne

**3. `src/App.css`** — Supprimer le `max-width: 1280px` et `padding: 2rem` sur `#root` qui contraignent le layout

