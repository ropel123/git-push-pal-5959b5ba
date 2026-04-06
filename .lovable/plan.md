
# Modifier le filtre DCE : filtrer par `dce_url` au lieu de `dce_uploads`

## Contexte

Le filtre "Avec DCE" actuel cherche les tenders qui ont des fichiers uploadés dans `dce_uploads`. L'utilisateur veut plutôt filtrer les tenders où le bouton "Récupérer le DCE automatiquement" est disponible — c'est-à-dire les tenders qui ont un champ `dce_url` renseigné.

## Modification

**Fichier : `src/pages/Tenders.tsx`**

Remplacer la logique du filtre DCE :
- **Avant** : requête sur `dce_uploads` pour trouver les `tender_id` avec des fichiers uploadés
- **Après** : simple filtre `.not("dce_url", "is", null)` et `.neq("dce_url", "")` sur la requête tenders directement

Cela simplifie le code (plus besoin de requête préalable sur `dce_uploads`) et correspond au besoin réel : voir les appels d'offres dont le DCE est récupérable automatiquement depuis le SaaS.

Mettre à jour le label du switch de "Avec DCE" à "DCE auto disponible" pour clarifier.
