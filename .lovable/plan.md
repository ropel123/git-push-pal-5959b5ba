## Objectif
Refondre `src/pages/Dashboard.tsx` pour reprendre la structure du dashboard DoubleTrade (référence utilisateur), mais avec la DA HackAO (crème + navy + accent bleu, tokens sémantiques, pas de couleurs HSL en dur).

## Structure cible

```
┌────────────────────────────────────────────────────────┐
│ HERO — gradient brand subtil                           │
│  Bonjour {prénom} !                                    │
│  [ 🔍 Rechercher un appel d'offres…  ]  → /tenders     │
└────────────────────────────────────────────────────────┘

┌─────────────────────────────────────┐  ┌───────────────┐
│ Mes dernières alertes reçues   ↗   │  │ Mes favoris ↗│
│ ┌──┬──┬──┬──┬──┬──┬──┐              │  │   donut +    │
│ │  │  │  │  │  │  │  │ 7 mini-cards │  │   légende    │
│ └──┴──┴──┴──┴──┴──┴──┘              │  │              │
└─────────────────────────────────────┘  └───────────────┘

┌─────────────────────────────────────────────────────────┐
│ Mes profils                              [filtre dates] │
│ [card] [card] [card] [card] [card] [card]               │
└─────────────────────────────────────────────────────────┘

┌──────────────────────┐  ┌──────────────────────────────┐
│ Calendrier           │  │ L'actualité des marchés      │
│ mini-calendar + jour │  │ publics — feed news (mock)   │
└──────────────────────┘  └──────────────────────────────┘
```

## Détails par bloc

### 1. Hero greeting
- `Card` arrondie avec `bg-gradient-brand` opacité 8% sur fond `bg-card`, padding généreux
- `h1` "Bonjour {user.email split @}" en `text-foreground`
- Champ recherche (Input + icône Search) → `navigate('/tenders?q=...')`

### 2. Mes dernières alertes reçues
- Source : `useAlerts(user?.id)` → 7 dernières
- Grid `grid-cols-2 sm:grid-cols-3 lg:grid-cols-7`, mini-card par alerte
- Contenu : timestamp `created_at` (format `dd/MM à HH:mm`), nom de l'alerte (`name`), badge `X non lus` (mock pour l'instant : count placeholder à 0)
- Lien CTA `↗` en haut à droite → `/settings` (gestion alertes)

### 3. Mes favoris
- Donut Recharts depuis `usePipelineDistribution` (déjà en place)
- Centré : total au milieu
- Légende verticale à droite avec icône colorée + label + % (utiliser `STAGE_COLORS` mais en passant aux tokens : `hsl(var(--accent))`, `hsl(var(--accent-soft))`, semantic warning/destructive/success)

### 4. Mes profils
- Source : `useSavedSearches` 
- Grid `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`
- Card avec icône cercle (alternance accent / accent-soft), nom recherche, sous-titre catégorie (filters.category ou "Tous")
- Click → `/tenders` avec préfiltre

### 5. Calendrier
- Reprendre `useUrgentTenders` (deadlines à venir)
- Côté gauche : composant `Calendar` (shadcn) du mois courant, points marqueurs sur jours avec deadline
- Côté droit : liste des deadlines du jour sélectionné (titre + heure si dispo)

### 6. Actualité des marchés publics
- Bloc statique pour l'instant (3 articles mock : titre, extrait, date, image placeholder de l'asset existant si dispo)
- Card scrollable

## Tokens & styling
- Tous les blocs en `Card` `bg-card border-border shadow-soft rounded-2xl`
- Couleurs : `text-foreground`, `text-muted-foreground`, `text-accent` pour liens/icônes, `bg-accent/10` pour pastilles
- Aucune couleur HSL en dur — refactor `STAGE_COLORS` pour utiliser les tokens via `hsl(var(--accent))`, `hsl(var(--accent-soft))`, `hsl(var(--primary))`, `hsl(var(--destructive))`, `hsl(142 71% 45%)` (success, à ajouter en token si besoin)
- Layout : `max-w-7xl mx-auto space-y-6 p-6`

## Fichiers touchés
- `src/pages/Dashboard.tsx` — réécriture complète, mêmes hooks
- Aucun changement de schéma / hooks / business logic

## Hors scope
- Pas de bannière illustrée chantier (remplacée par gradient brand)
- Pas de nouveau backend / table (alertes "non lus" mock pour l'instant)
- Pas de touche aux autres pages