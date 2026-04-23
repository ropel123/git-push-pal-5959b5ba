

# Récap des URLs à enregistrer depuis `urls_format_scrap.xlsx`

## Plan

1. Copier `user-uploads://urls_format_scrap.xlsx` → `/tmp/urls_scrap.xlsx`.
2. Lire toutes les feuilles avec `openpyxl` (texte des cellules + `cell.hyperlink.target`).
3. Extraire les URLs (`https?://...`) et le contexte de la même ligne (libellé, acheteur si présent).
4. Classifier chaque URL via la même logique que `src/lib/detectPlatform.ts` (hostname + path → `aura`, `atexo`, `mpi`, `place`, `maximilien`, `megalis`, `ternum`, `klekoon`, `safetender`, `custom`, etc.). Pas de sondage HTTP.
5. Restituer dans le chat :
   - **Récap chiffré** : total URLs, répartition par plateforme, liste des `custom`.
   - **Tableau Markdown** trié par plateforme (`# | Plateforme | URL | Nom`).
6. Générer aussi un CSV téléchargeable `/mnt/documents/urls_format_scrap_classified.csv` (`url, platform, display_name, sheet, row`) pour que tu aies le fichier sous la main.

## Ce que je ne fais pas

- Pas d'`INSERT` dans `sourcing_urls`.
- Pas de migration SQL.
- Pas d'appel à `reclassify-sourcing-urls` ni au fingerprint HTTP.

## Livrable

- Récap + tableau directement dans la conversation.
- CSV : `/mnt/documents/urls_format_scrap_classified.csv`.

