# Fix `fetch-dce-mpi` — navigation publication → page DCE

## Problème

Logs montrent :
```
GET landing .../fuseaction=pub.affPublication&refPub=...&IDS=4992
landing forms=1 → captcha=false cookies=0  (rien à faire)
ERROR Not on DCE page (lots/télécharger not found)
```

L'URL stockée dans `tenders.dce_url` est la **page publication** (vue publique de l'AO), pas la **page de retrait DCE** (`fuseaction=dematEnt.login&type=DCE&IDM=...`). Le flow MPI réel est :

```
publication (pub.affPublication?IDS=...)
    ↓ clic "Retirer le DCE"
dematEnt.login&type=DCE&IDM=...
    ↓ login (captcha + email/pwd) 1ère fois
page DCE avec lots + télécharger
```

Bonus : on est sur `marchespublicsmanche.fr` (portail enfant MPI), pas `marches-publics.info`. La constante `BASE` du client doit être dérivée de l'URL d'entrée.

## Corrections

### 1. `_shared/mpiClient.ts`

- **Supprimer `BASE` constant**, le dériver à chaque call : `new URL(dceUrl).origin`.
- **Ajouter `resolveDceUrl(jar, startUrl)`** :
  - Si l'URL contient déjà `fuseaction=dematEnt.login` et `type=DCE` → retourner telle quelle.
  - Sinon : GET la page, chercher un lien `<a href>` contenant `dematEnt.login` + `type=DCE` (ou texte "Retirer le DCE" / "Télécharger le DCE"). Retourner cette URL absolue.
  - Si introuvable : essayer de construire `…?fuseaction=dematEnt.login&type=DCE&IDM=<refPub ou IDS>` (fallback heuristique) puis throw si rien ne marche.

### 2. `fetch-dce-mpi/index.ts`

- Au début, appeler `resolveDceUrl(jar, dce_url)` → utiliser le résultat comme `dceUrl` pour login + download.
- Logger `dce.resolve_url` (ok avec URL résolue, ou skipped si identique).
- Probe de session : pareil, sur l'URL résolue.

### 3. Détail technique : extraction du lien DCE

Sur la page publication MPI, le bouton "Retirer le DCE" est typiquement :
```html
<a href="index.cfm?fuseaction=dematEnt.login&type=DCE&IDM=1820420">
  Retirer le DCE
</a>
```
Regex : `/<a[^>]*href=["']([^"']*fuseaction=dematEnt\.login[^"']*type=DCE[^"']*)["']/i`
Si plusieurs matches, prendre le premier.

## Test

Re-cliquer le bouton DCE Agent sur l'AO actuel (`f6f11b9e-...`). Attendu dans les logs :
```
GET landing pub.affPublication
dce.resolve_url ok → .../dematEnt.login&type=DCE&IDM=...
GET dce → captcha + login → cookies persistés
download → upload bucket
```