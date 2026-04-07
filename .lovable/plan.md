

# Pourquoi le PricingChat n'apparaît pas + corrections

## Diagnostic

Le composant PricingChat est bien implémenté et présent dans `TenderDetail.tsx`, mais il est conditionné par `pipelineItem && ...`. Or ce tender n'est pas dans ton pipeline — donc la section est masquée.

De plus, il y a un bug : quand tu cliques "Pipeline" pour ajouter l'AO, la fonction `addToPipeline` ne recharge pas l'état `pipelineItem` après le succès. Donc même après ajout, le PricingChat ne s'affiche pas sans recharger la page.

## Corrections à faire

### 1. Fix `addToPipeline` — recharger le pipeline item après ajout
**Fichier** : `src/pages/TenderDetail.tsx`

Ajouter `fetchPipelineItem()` dans le callback de succès de `addToPipeline`. Aussi changer le bouton pour indiquer "Déjà dans le pipeline" quand `pipelineItem` existe.

### 2. Rendre le bouton Pipeline plus intelligent
- Si `pipelineItem` existe : afficher "Dans le pipeline ✓" (désactivé ou lien vers Pipeline)
- Si non : afficher "+ Pipeline" comme actuellement

### 3. Optionnel : afficher un message d'indication
Quand `pipelineItem` n'existe pas, afficher un petit encadré sous les analyses : "Ajoutez cet AO à votre pipeline pour accéder à l'assistant de chiffrage IA"

## Fichier modifié
- `src/pages/TenderDetail.tsx` — fix du callback + UX du bouton pipeline

