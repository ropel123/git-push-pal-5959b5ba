# Filtre par plateforme sur /tenders

## Objectif
Permettre de trier/filtrer la liste des appels d'offres par plateforme source (BOAMP, TED, ATEXO, Maximilien, MPI, achatpublic, etc.) — comme les filtres Région, Statut, Procédure déjà présents.

## Source de la donnée
La colonne `tenders.source` contient déjà l'info :
- `boamp`, `ted` pour les sources nationales
- `scrape:atexo`, `scrape:maximilien`, `scrape:mpi`, `scrape:achatpublic`, `scrape:e-marchespublics`, `scrape:marches-securises`, `scrape:aura`, `scrape:custom`…

Aucune migration n'est nécessaire.

## Changements UI (`src/pages/Tenders.tsx`)
1. Nouveau state `platformFilter` + `platforms: string[]`.
2. Au montage, charger la liste distincte des `source` (comme on charge déjà `procedures`) et l'afficher en libellés lisibles : `boamp` → "BOAMP", `ted` → "TED", `scrape:atexo` → "ATEXO", etc. (mapping simple via une petite fonction `formatPlatformLabel`).
3. Ajouter un `<Select>` "Plateforme" dans la barre de filtres, à côté de Procédure.
4. Inclure `platformFilter` dans :
   - le payload `useTenders({ ..., platform })`
   - la sauvegarde/restauration des recherches sauvegardées
   - le bouton "Réinitialiser"

## Changements data (`src/hooks/queries/useTenders.ts`)
- Ajouter `platform?: string` à `TendersFilters`.
- Si `platform && platform !== "all"` → `query.eq("source", platform)`.
- Ajouter `platform` à la `queryKey`.

## Hors scope
- Pas de nouvelle colonne en base.
- Pas de modification du backend / scraping.
- Pas de refonte visuelle des autres filtres.