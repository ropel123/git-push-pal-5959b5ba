Objectif : faire télécharger à l’agent le bouton exact associé à la ligne **“DCE (ou Pièces communes)”**, visible sur la page AW Solutions/MPI, au lieu de cliquer des boutons “Télécharger” au hasard ou de s’arrêter après la sélection des lots.

Plan d’implémentation :

1. **Ajouter une détection dédiée AW Solutions dans `download_all_pieces`**
   - Avant le fallback générique, analyser les lignes visibles de la page.
   - Chercher le libellé `DCE (ou Pièces communes)` / `DCE` / `Pièces communes`.
   - Identifier le bouton `Télécharger` situé dans la même ligne ou sur la même hauteur visuelle.

2. **Cliquer ce bouton en priorité**
   - Faire défiler la ligne au centre.
   - Cliquer le bouton correspondant uniquement à cette ligne.
   - Déclencher les événements nécessaires (`click`, éventuellement focus/mousedown/mouseup si besoin) pour que le téléchargement parte.
   - Attendre quelques secondes que Browserbase capture le fichier.

3. **Conserver les comportements existants en fallback**
   - Si la page est une page de sélection de lots, garder la logique de sélection/soumission déjà ajoutée.
   - Si le bouton “DCE (ou Pièces communes)” n’est pas trouvé, retomber sur le fallback actuel qui clique les boutons “Télécharger” visibles.

4. **Améliorer les traces de debug**
   - Journaliser explicitement : `DCE pièces communes cliqué`, le texte de ligne trouvé, et le nombre de boutons candidats.
   - Cela permettra de vérifier rapidement dans `agent_runs` que le bon bouton a été ciblé.

5. **Vérification après implémentation**
   - Relancer l’agent sur ce tender.
   - Résultat attendu : téléchargement du fichier d’environ `209489 ko`, archive Browserbase récupérée, upload dans `dce-documents`, et entrée `dce_uploads` créée.