## Problème
`TrustSection` a un fond `bg-black` + sparkles orange + dégradés sombres → incompatible avec la DA HackAO crème.

## Changements `src/components/TrustSection.tsx`
- `bg-black` → `bg-background`
- Supprimer les overlays sombres (`from-black/80 to-transparent`, gradient bottom primary/10)
- Radial gradient overlay : passer à `hsl(var(--accent)/0.08)` pour halo bleu doux
- Sparkles : couleur `hsl(224 76% 56%)` (accent bleu), densité réduite (300), opacité abaissée
- Logos : passer `brightness-125/150` → simple `grayscale opacity-70 hover:opacity-100`, retirer les boosts de luminosité (utiles seulement sur fond noir)
- Eyebrow `bg-primary/10 text-primary` → `bg-accent/10 text-accent`