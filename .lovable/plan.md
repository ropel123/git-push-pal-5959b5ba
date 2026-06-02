## Problème

`src/components/FAQSection.tsx` utilise des classes couleur en dur héritées du thème dark (`text-white`, `text-white/60`, `text-white/70`, `text-white/50`, `border-white/10`). Sur le fond crème HackAO, le texte devient quasi invisible (cf. capture).

## Correctif

Remplacer toutes les couleurs en dur par les tokens sémantiques HackAO :

| Avant | Après |
|---|---|
| `text-white` (titre questions + H2) | `text-foreground` |
| `text-white/60` (sous-titre) | `text-muted-foreground` |
| `text-white/70` (réponse) | `text-muted-foreground` |
| `text-white/50` (footer FAQ) | `text-muted-foreground` |
| `border-white/10` (séparateur items) | `border-border` |
| `text-primary` (eyebrow + chevron + lien) | `text-accent` (plus cohérent : bleu vif HackAO réservé aux accents, `primary` = navy donc OK aussi, mais accent plus lisible pour eyebrow/lien) |
| `hover:text-primary` sur question | `hover:text-accent` |

Aucune autre modification (structure, animations, contenu inchangés).

## Pendant qu'on y est

Audit rapide `rg "text-white|bg-orange|border-white/"` sur `src/components/*.tsx` et `src/pages/*.tsx` pour repérer les autres composants landing qui souffrent du même bug (probablement `HeroSection`, `TrustSection`, `ProblemsSection`, `SolutionSection`, `ProcessSection`, `WhySection`, `TargetSection`, `PricingSection`, `CTASection`, `HoverFooter`, `Navbar`). Je liste les fichiers touchés et je corrige dans la foulée selon la même grille de mapping.

## Hors scope

- Pas de refonte de structure, pas de nouveaux composants.
- Pas de changement de logique métier.
