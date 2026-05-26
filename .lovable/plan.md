## Objectif
Permettre de relancer la reclassification IA uniquement sur les URLs d'une plateforme précise (ex: `mpi`), en plus des options actuelles "custom" et "toutes".

## Changements (`src/pages/Sourcing.tsx` uniquement)

1. **Élargir `reclassifyAll`** pour accepter un scope `"all" | "custom" | { platform: string }`. Quand un objet `{ platform }` est passé, filtrer `query.eq("platform", platform)` et adapter les labels/toast.

2. **Enrichir le menu déroulant** à côté du bouton "Re-classifier custom" :
   - Garder les deux entrées existantes ("Relancer uniquement les custom", "Relancer toutes les URLs").
   - Ajouter un séparateur puis une entrée par plateforme distincte présente dans `urls` (ex: `mpi`, `atexo`, `marches-securises`, `achatpublic`, etc.), avec le compteur correspondant : `Relancer uniquement {platform} (N)`.
   - Pour ne pas surcharger : ne lister que les plateformes ayant ≥1 URL, triées par count desc.

3. Pas de changement back-end : la fonction `reclassify-sourcing-urls` est déjà appelée par id.

## Détails techniques
- Calcul des plateformes : `const platformCounts = useMemo(() => { ... groupBy urls.platform ... }, [urls])`.
- Le `confirm()` et les toasts utilisent le nom de plateforme dans `scopeLabel`.
- Le bouton principal reste "Re-classifier custom" (comportement par défaut inchangé).