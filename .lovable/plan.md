## Problème

Sur le dashboard, en mode sombre :
- Les **cartes restent blanches** (fond `bg-white` codé en dur) alors que le fond de page est noir → contraste cassé
- Les **titres de cartes** ("Mes dernières alertes reçues", "Mon pipeline", "L'actualité des marchés publics") deviennent invisibles car ils utilisent une couleur claire qui, sur fond blanc, disparaît
- Bordures `border-black/[0.06]`, fonds `bg-[#F8FAFC]`, `bg-white`, textes `text-[#111827]`, `text-[#6B7280]` → toutes ces valeurs sont hardcodées et ne réagissent pas au thème

Cause racine : `src/pages/Dashboard.tsx` bypasse le design system (tokens sémantiques `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, etc.) et utilise des couleurs brutes en dur.

## Correction

Refactoriser **uniquement `src/pages/Dashboard.tsx`** pour remplacer les couleurs hardcodées par les tokens sémantiques déjà définis dans `src/index.css` / `tailwind.config.ts`. Aucun changement de layout, de contenu, ni de logique.

Table de correspondance appliquée :

| Hardcodé | Token sémantique |
|---|---|
| `bg-white` (carte) | `bg-card` |
| `bg-[#F8FAFC]` (sous-carte) | `bg-muted/40` |
| `bg-[#F3F4F6]` (badge) | `bg-muted` |
| `border-black/[0.06]`, `border-black/[0.07]`, `border-black/[0.08]` | `border-border` |
| `text-[#111827]` | `text-foreground` |
| `text-[#6B7280]`, `text-[#9CA3AF]` (placeholder) | `text-muted-foreground` / `placeholder:text-muted-foreground` |
| `text-[#2563EB]`, `bg-[#2563EB]` (accents) | `text-accent` / `bg-accent` (déjà HSL 224 76% 56%) |
| Titres de cartes | ajouter/garder `text-foreground` explicite |

## Vérification

Après changement :
- Passer en mode sombre depuis le ThemeToggle et vérifier visuellement le dashboard
- Vérifier que le mode clair reste identique à aujourd'hui (les tokens `card`, `foreground`, `muted` sont déjà thémés dans les deux modes)

## Fichier modifié

- `src/pages/Dashboard.tsx` — remplacement chirurgical des couleurs hardcodées par les tokens sémantiques

## Hors scope

- Les autres pages qui pourraient avoir le même problème (Tenders, Pipeline, etc.) — à traiter séparément si tu le confirmes. Dis-moi si tu veux que j'audite tout le codebase en même temps ou juste le dashboard pour l'instant.
