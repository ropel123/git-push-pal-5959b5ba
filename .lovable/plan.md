Constat : le job actuel est bloqué à `14/15` depuis plusieurs minutes. La table `rescrape_jobs` est encore en `running`, mais `updated_at` ne bouge plus. Le problème vient du worker `rescrape-batch` : il lance deux appels `scrape-list` en parallèle et attend qu’ils finissent tous. Si le dernier appel reste pendu/tue par la limite Edge Runtime, le job ne passe jamais en `done` ou `failed`, donc l’UI continue d’afficher un spinner indéfiniment.

Plan de correction :

1. Sécuriser `rescrape-batch`
   - Mettre un timeout dur autour de chaque appel `scrape-list` pour qu’une URL lente ne bloque jamais tout le batch.
   - Remplacer l’attente globale fragile par un traitement plus défensif : chaque URL se termine en succès ou erreur, puis incrémente `done`.
   - Marquer le job en `done` même s’il y a des erreurs partielles, et en `failed` seulement si le worker crash réellement.

2. Ajouter une reprise des jobs bloqués
   - Au démarrage d’un nouveau batch, nettoyer les anciens jobs `running` sans progression récente en `failed` avec un message du type `stale worker timeout`.
   - Ainsi l’interface ne restera plus bloquée sur un ancien job mort.

3. Améliorer l’UI de suivi dans `Sourcing.tsx`
   - Lors du polling, détecter un job `running` dont `updated_at` est trop ancien.
   - Afficher `bloqué / timeout probable` au lieu d’un spinner infini, avec un toast clair.
   - Libérer le bouton pour pouvoir relancer.

4. Optionnel mais recommandé après correction
   - Marquer manuellement le job actuel `5684dfdb-1be9-42ca-8365-aede3505935f` comme terminé ou failed afin de débloquer immédiatement l’interface.