## Constat

La fiche affichée vient bien du scraping MPI, mais l’item SIAAP a été créé avec :
- `source_url = NULL`
- `dce_url = NULL`
- seulement l’URL de listing dans `enriched_data.raw._source_url`

Résultat : l’app affiche “Voir sur la plateforme acheteur” vers la page de recherche, et aucun bouton DCE n’apparaît.

## Plan de correction

1. **Corriger l’extraction MPI legacy**
   - Adapter le moteur `playbookExecutor` pour que les pages MPI `marchesP.rechM` soient traitées en mode hybride : liste puis liens détail.
   - Étendre la détection des liens détail MPI pour reconnaître les URLs avec `IDS=...`, notamment les variantes du type `pub.affRech`, `pub.affAvis`, `pub.affPublication`, etc.
   - Éviter de considérer `marchesP.rechM` sans `IDS` comme une vraie fiche détail.

2. **Sécuriser la normalisation des URLs**
   - Garder le rejet des listings génériques.
   - Accepter comme `source_url` / `dce_url` uniquement les liens détail réels contenant un identifiant de consultation.
   - Conserver la protection anti BOAMP/TED.

3. **Relancer le scraping sur les plateformes concernées**
   - Relancer `scrape-list` sur SIAAP et les autres MPI passées en `marchesP.rechM`.
   - Vérifier que les fiches existantes sont mises à jour via leur couple `source + reference`.

4. **Valider le résultat côté données**
   - Contrôler sur l’AO SIAAP que `source_url` ou `dce_url` est maintenant renseigné.
   - Vérifier dans l’interface que le bouton/lien pointe vers la fiche acheteur réelle, pas vers le listing.

## Détails techniques

Fichiers probablement concernés :
- `supabase/functions/_shared/playbookExecutor.ts`
- éventuellement `supabase/functions/upsert-tenders/index.ts` si un pattern générique bloque encore les liens MPI avec `IDS`

Aucune modification de schéma Supabase n’est nécessaire.