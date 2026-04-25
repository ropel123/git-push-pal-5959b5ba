# Ajout d'un bouton "Relancer les custom" sur Sourcing

## Contexte

Le backend `reclassify-sourcing-urls` supporte déjà le paramètre `only_custom` mais le frontend n'expose pas l'option. Aujourd'hui le bouton "Re-classifier" relance les 116 URLs alors que tu veux souvent ne relancer que les ~58 qui sont en `custom`.

## Changements

### `src/pages/Sourcing.tsx`

1. **Refactor `reclassifyAll`** pour accepter un paramètre `scope: "all" | "custom"`.
   - Quand `scope === "custom"`, la requête `sourcing_urls` filtre `platform IN ('custom','safetender')`.
   - Le toast de fin affiche en plus "X récupérées" pour le mode custom (URLs qui sont sorties du custom grâce au nouveau pipeline).

2. **Remplacer le bouton unique par un split-button** (un menu déroulant à côté du bouton principal) :
   - Bouton principal "Re-classifier custom" (action par défaut, la plus utile maintenant)
   - Menu déroulant avec 2 options :
     - "Relancer uniquement les custom (~N)" — appelle `reclassifyAll("custom")`
     - "Relancer toutes les URLs (~M)" — appelle `reclassifyAll("all")`
   - Le compteur N/M est calculé en live depuis le state `urls`.

3. **Confirmation adaptée** : le `confirm()` mentionne le bon scope ("X URLs en custom/safetender" vs "les X URLs").

## Hors scope

- Pas de changement backend (l'edge function gère déjà `only_custom`)
- Pas de changement DB
- Pas de touche au pipeline de classification (déjà refondu juste avant)
