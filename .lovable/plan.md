## Plan de correction MPI

Le problème vient du flux MPI actuel : le scraper récupère bien la page de liste, mais l’URL stockée pour l’avis peut rester l’URL de recherche/liste (`affPublication`), donc le bouton “Voir sur la plateforme acheteur” renvoie vers toute la liste au lieu de la fiche détail.

### 1. Ajouter une extraction MPI dédiée dans le scraper
- Dans `playbookExecutor.ts`, ajouter une étape spécifique pour les pages MPI.
- Depuis la page de liste, détecter les vrais liens “Avis” associés aux lignes de marchés : URLs du type `index.cfm?fuseaction=pub.affPublication&refPub=...&server=MPI...` ou variantes MPI équivalentes.
- Transformer les liens relatifs en URLs absolues avec le domaine source (`marchespublics.siaap.fr`, etc.).
- Exclure explicitement les liens génériques de recherche/liste sans identifiant d’avis.

### 2. Scraper les fiches détail MPI avant l’upsert
- En mode `SMART/DEEP`, scraper chaque URL “Avis” trouvée, comme une fiche détail.
- Forcer `dce_url` et `source_url` de l’item extrait vers cette URL détail réelle.
- Conserver l’URL liste en `enriched_data.listing_url` uniquement comme fallback/debug.

### 3. Mieux matcher liste ↔ fiche détail
- Quand la fiche détail donne une référence (`20260060`, etc.), elle sera dédupliquée via `(source, reference)` et mettra à jour l’appel d’offres existant.
- Si plusieurs items viennent de la liste, éviter de garder l’item liste incomplet quand une fiche détail existe pour la même référence/titre.

### 4. Renforcer la protection UI
- Dans `TenderDetail.tsx`, considérer `fuseaction=pub.affPublication` sans `refPub/refConsult/refCons` comme lien générique.
- Si seule une URL de liste est disponible, garder le libellé fallback ; si une URL détail est disponible, afficher “Voir l’avis original”.

### 5. Déployer et valider
- Déployer `scrape-list` après modification.
- Relancer uniquement les sources MPI depuis le nouveau menu.
- Vérifier que l’avis SIAAP `20260060` pointe bien vers la page détail et récupère description/référence/date/acheteur depuis la fiche affichée dans tes captures.