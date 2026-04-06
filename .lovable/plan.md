
# Ajouter un filtre "DCE disponible" sur la page Appels d'offres

## Contexte

L'utilisateur veut pouvoir filtrer les appels d'offres pour ne voir que ceux qui ont des documents DCE (uploadés manuellement ou téléchargés automatiquement).

## Implementation

**Fichier : `src/pages/Tenders.tsx`**

1. Ajouter un état `dceFilter` (boolean toggle) — "Avec DCE uniquement"
2. Quand le filtre est actif, faire une requête préalable sur `dce_uploads` pour récupérer les `tender_id` distincts qui ont des fichiers, puis filtrer les tenders avec `.in("id", tenderIds)`
3. Alternativement (plus performant) : créer une vue SQL ou utiliser un filtre côté client. La meilleure approche est de joindre via une sous-requête.

**Approche retenue** : Utiliser un filtre en 2 étapes dans `fetchTenders` :
- Si `dceFilter` est actif, d'abord récupérer les `tender_id` depuis `dce_uploads` (SELECT DISTINCT tender_id), puis ajouter `.in("id", tenderIds)` à la requête principale
- Ajouter un bouton toggle/switch dans la barre de filtres avec une icône `FileText`

4. Ajouter une icône `FileText` sur chaque carte de tender qui a des DCE (petit badge visuel) — optionnel mais utile pour repérer rapidement

**UI** : Ajouter dans la zone de filtres (grid md:grid-cols-3 → md:grid-cols-4) un Select ou un Switch "DCE disponible" avec les options : Tous / Avec DCE uniquement.

**Sauvegarde** : Inclure `dceFilter` dans les filtres sauvegardés et dans `applySavedSearch`.
