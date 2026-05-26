Le blocage vient probablement de la détection trop large : le code peut détecter l’en-tête “Pièces communes” comme libellé prioritaire, puis cliquer le premier bouton Télécharger de cette section (“Conditions d’accès…”) au lieu de la ligne exacte “DCE (ou Pièces communes)”.

Plan d’implémentation :

1. Rendre la cible stricte
   - Prioriser uniquement le texte exact ou quasi exact “DCE (ou Pièces communes)”.
   - Ne plus considérer “Pièces communes” seul comme cible cliquable, car c’est un en-tête de section.

2. Cliquer le bouton aligné avec la ligne DCE
   - Identifier la ligne dont le texte contient “DCE (ou Pièces communes)”.
   - Trouver le bouton “Télécharger” dans le même `<tr>`.
   - Si la page n’a pas de vrais `<tr>`, utiliser l’alignement vertical : bouton Télécharger dont le centre Y est le plus proche du libellé DCE, avec tolérance courte.

3. Éviter les mauvais téléchargements
   - Exclure explicitement les lignes comme “Conditions d’accès”, “Information sur les dépôts”, “AAPC”, “Règlement de consultation”, et les lots spécifiques.
   - Désactiver le fallback générique “clique tous les Télécharger” sur cette page quand une ligne DCE existe mais que le bouton n’est pas trouvé, pour éviter de partir sur le mauvais fichier.

4. Ajouter un log de diagnostic utile
   - Journaliser les candidats visibles avec leur texte, leur position Y et le bouton choisi.
   - Le prochain run indiquera clairement si la ligne DCE a été trouvée et quel bouton exact a été cliqué.

Validation attendue : au relancement, l’agent doit cliquer le bouton Télécharger situé sur la ligne “DCE (ou Pièces communes)” avec la taille ~209489 Ko, et non le premier bouton de la section.