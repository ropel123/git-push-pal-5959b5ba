## Objectif

Refondre toute l'interface (landing publique + app authentifiée) sur la nouvelle DA **HackAO** : mode light crème + bleu marine, accent bleu vif et dégradé bleu→jaune, nouveau logo symbole+wordmark, renommage "Hackify" → "HackAO" partout.

## Direction artistique (verrouillée)

**Palette (light par défaut, dark conservé en alt)**

| Token | Valeur HSL | Usage |
|---|---|---|
| `--background` | `42 60% 96%` (crème #FBF5E5) | Fond app |
| `--foreground` | `224 71% 12%` (navy #0B1437) | Texte principal |
| `--card` | `0 0% 100%` | Surfaces |
| `--primary` | `224 71% 18%` (navy #131C4A) | Boutons primaires, sidebar |
| `--primary-foreground` | `42 60% 96%` | |
| `--accent` | `224 76% 56%` (bleu vif #3B5CE6) | Liens, focus, badges actifs |
| `--accent-soft` | `42 90% 80%` (jaune crème) | Highlights, tags |
| `--muted` | `42 30% 92%` | Inputs, hovers |
| `--border` | `224 20% 88%` | |
| `--gradient-brand` | `linear-gradient(135deg, #3B5CE6 → #F5C76A)` | Hero, CTA premium, badge AI |
| `--ring` | accent | |

Dark mode : navy profond `#0B1437` fond, crème `#FBF5E5` texte, mêmes accents.

**Typo** : Inter (déjà chargé) — titres en weight 600/700 tracking serré, body 400-500. H1 jusqu'à 56px sur landing, 32px en app.

**Logo** : symbole "fleur" navy + wordmark "HackAO" (AO en bleu vif). Variante symbole seul pour favicon et sidebar collapsed. Versions navy / blanc / gradient.

**Motifs récurrents** : cartes radius `1rem`, ombre douce, accent bleu en bord gauche des éléments actifs, badges pill cream + texte navy, dégradé brand réservé aux moments forts (hero, CTA principal, score AI).

## Étapes

### 1. Foundations (tokens + logo + branding)
- Réécrire `src/index.css` : nouvelles variables `:root` (light) et `.dark`, gradient brand, shadows.
- Mettre à jour `tailwind.config.ts` (couleurs `accent-soft`, `gradient-brand`).
- Créer composant `<HackaoLogo variant="full|symbol" tone="navy|white|gradient" />` (SVG inline reproduit depuis la guideline) dans `src/components/brand/HackaoLogo.tsx`.
- Remplacer le favicon (`public/favicon.png` à partir du symbole).
- Renommer **Hackify → HackAO** : `index.html` (title, meta, OG), `AppSidebar`, `Navbar`, `Auth`, emails, `README.md`, mémoire projet (`mem://index.md`, `mem://projet/branding-et-metadata`, `mem://style/identite-visuelle`).
- Inverser le défaut de thème : light par défaut, dark en option (`ThemeToggle`).

### 2. App shell authentifiée
- `AppLayout` + `AppSidebar` : fond crème, sidebar blanche/navy avec logo en haut, items navy avec accent bleu sur actif (bord gauche + fond `accent-soft/40`), trigger collapse, footer user.
- Header : breadcrumb navy, `NotificationBell` repensée (badge accent), search input crème.

### 3. Pages app (par lot, même grammaire visuelle)
- **Lot A — Coeur tender** : `Dashboard`, `Tenders` (cards + filtres), `TenderDetail` (hero gradient + tabs `TenderAnalysisSection`), `Pipeline` (Kanban — colonnes cream, cards blanches).
- **Lot B — Annexes** : `Awards`, `BuyerDetail`, `Activity`, `Sourcing`, `AgentMonitor`, `SettingsPage`, `Onboarding`, `Auth`.
- Composants partagés à reskinner : `Badge`, `Button` (variante `gradient` pour CTA principal), `Card`, `Input`, `Tabs`, `Switch`, `Progress`, `DceAgentFetchButton`, `MemoirAIChat`, `PricingChat`, `TenderDocumentGenerator`.

### 4. Landing publique (`/`)
- Reprendre `HeroSection`, `ProblemsSection`, `SolutionSection`, `ProcessSection`, `WhySection`, `TargetSection`, `PricingSection`, `TrustSection`, `FAQSection`, `CTASection`, `Navbar`, `HoverFooter` sur fond crème, hero avec dégradé brand + symbole HackAO en grand, sections alternant crème / blanc / navy.

### 5. QA
- Pass visuel route par route (light + dark), vérifier contrastes (WCAG AA), pas de classe couleur en dur (`text-white`, `bg-orange-*`, etc.) résiduelle — sweep `rg` final.
- Vérifier que tous les `Hackify` ont disparu.

## Hors scope
- Pas de changement de logique métier, routes, schéma DB, edge functions.
- Pas de refonte du Kanban en termes de stages/colonnes (juste skin).
- Génération PDF/PPTX : on garde la logique, on adapte juste les couleurs/logo de marque dans `generatePdf.ts` / `generatePptx.ts`.

## Livraison
Je propose d'exécuter en deux passes commitables :
1. **Pass 1** : étapes 1 + 2 + 3 lot A → tu valides le look, ensuite
2. **Pass 2** : étape 3 lot B + étape 4 + QA.

Ça évite un mégacommit, et tu peux ajuster la DA après le lot A si besoin.
