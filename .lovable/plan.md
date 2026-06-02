## Objectif
Remplacer l'animation WebGL shader sombre du hero par un fond crème clair avec un gradient de marque subtil (bleue → crème), et corriger le texte "HACKIFY" restant.

## Changements

### 1. `src/components/ui/animated-shader-hero.tsx`
- Supprimer tout le code WebGL (WebGLRenderer, PointerHandler, useShaderBackground, defaultShaderSource)
- Remplacer le canvas + overlays sombres (`bg-black/50`, `to-black`) par un fond CSS pur :
  - `bg-background` (crème) comme base
  - 3 blobs radiaux animés en CSS (bleu brand, crème brand, bleu brand) avec `blur` et opacité très faible (6–12%)
  - Animations `float-slow` / `float-slower` en keyframes CSS (18–25s, ease-in-out, infinite)
  - Garder le gradient bottom fade mais vers `to-background` pour fondre dans la section suivante
- Conserver toute la structure du contenu (trustBadge, headline, subtitle, boutons, scroll indicator)

### 2. `src/components/HeroSection.tsx`
- Remplacer `HACKIFY combine` par `HackAO combine` dans le subtitle

## Résultat attendu
Hero lumineux, sobre et élégant, cohérent avec la DA HackAO crème + navy. Plus de shader sombre qui rendait le texte illisible.