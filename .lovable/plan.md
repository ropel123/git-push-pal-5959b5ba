## Objectif
Corriger l’agent DCE MPI : il coche bien tous les lots, mais le clic sur “Télécharger les DCE sélectionnés” ne déclenche pas l’archive Browserbase. Il faut ensuite cibler et cliquer le lien/fichier **“DCE (ou Pièces communes)”** sur la page suivante.

## Plan d’implémentation
1. **Modifier `download_all_pieces` dans `supabase/functions/fetch-dce-agent/index.ts`**
   - Après soumission de la sélection des lots, ne pas arrêter l’étape immédiatement.
   - Attendre la navigation / mise à jour de page, puis lancer une deuxième passe dédiée au téléchargement réel.

2. **Ajouter une détection robuste de la ligne “DCE (ou Pièces communes)”**
   - Chercher les libellés visibles : `DCE (ou Pièces communes)`, `Pièces communes`, `DCE`.
   - Identifier le bouton/lien `Télécharger` dans la même ligne ou à proximité visuelle.
   - Cliquer ce lien en priorité.

3. **Améliorer le fallback si le bouton est hors ligne DOM**
   - Si aucun bouton n’est trouvé dans le même `<tr>`, chercher les boutons `Télécharger` alignés verticalement avec le libellé.
   - Cliquer le meilleur candidat proche de la ligne “DCE”.

4. **Attendre davantage le démarrage du téléchargement**
   - Après le clic final, attendre suffisamment pour que Browserbase capture le fichier volumineux.
   - Garder les anciens fallbacks génériques uniquement si la cible “DCE / Pièces communes” n’est pas trouvée.

5. **Ajouter des logs de diagnostic**
   - Logguer si l’agent a soumis les lots puis cliqué “DCE (ou Pièces communes)”.
   - Logguer les cas `label_without_button`, `no_label`, et le nombre de candidats visibles pour faciliter le prochain debug.

## Validation prévue
- Déployer / relancer la fonction `fetch-dce-agent`.
- Relancer l’agent sur l’appel d’offres concerné.
- Succès attendu : `files_downloaded > 0`, archive Browserbase récupérée, fichier uploadé dans `dce-documents`, entrée créée dans `dce_uploads`.