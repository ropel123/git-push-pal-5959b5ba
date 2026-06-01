# Marquer les AO avec DCE déjà récupéré

## Objectif
Sur `/tenders`, voir d'un coup d'œil les appels d'offres dont le DCE est déjà dans `dce_uploads` (récupéré par l'agent IA ou uploadé manuellement), et pouvoir filtrer dessus.

## Changements

### 1. Nouveau hook `useDceUploadedTenderIds` (src/hooks/queries/useDceUploads.ts)
- Récupère `tender_id` distincts de `dce_uploads` pour l'utilisateur courant.
- Renvoie un `Set<string>` pour lookup O(1).
- Retourne aussi un flag `agent_run_id != null` pour distinguer agent vs upload manuel.

### 2. Liste des AO (src/pages/Tenders.tsx)
- Utiliser le hook → `dceReadyMap: Map<tenderId, { hasFile: true, viaAgent: boolean }>`.
- Pour chaque carte AO : afficher un badge **"DCE récupéré"** (vert) avec icône `CheckCircle2` quand présent. Tooltip "Récupéré par l'agent IA" ou "Uploadé manuellement".
- Le badge existant "DCE auto" (basé sur `tender.dce_url`) reste inchangé — il indique juste la dispo, pas le téléchargement effectif.

### 3. Nouveau filtre "DCE déjà récupéré"
- Ajouter un switch à côté du filtre "DCE auto disponible" dans le panneau Filtres.
- Filtrage **côté client** sur la page courante (les uploads sont user-scopés et peu nombreux, pas besoin de toucher la query SQL).
- Inclus dans `saveSearch` / `applySavedSearch`.

## Hors scope
- Pas de modif backend ni de migration.
- Pas de modif des edge functions.
- `DceAgentFetchButton` inchangé.
