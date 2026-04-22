

# Audit URLs cassées + plan correctif

## Constat de base (fait via SQL)

| Source | Total | Avec `dce_url` | Avec `source_url` | État |
|---|---|---|---|---|
| `boamp` | 334 | 163 | 334 | OK (lien BOAMP toujours valide) |
| `ted` | 300 | 204 | 300 | OK (lien TED toujours valide) |
| `scrape:atexo` | 55 | 55 | 55 | OK (PLACE) |
| `scrape:mpi` | 33 | 30 | 30 | **3 lignes vidées par la migration de tout à l'heure** |
| `scrape:safetender` | 10 | 10 | 10 | OK |
| `scrape:place` | 2 | 2 | 2 | **Données de TEST fictives (12345, 67890)** ← screenshot |

**Total cassé après le fix : ~5 lignes**, pas "toutes". Mais l'expérience est mauvaise pour 3 raisons réelles que j'ai laissées passer.

## Les 4 vrais problèmes

### Problème A — Données de test PLACE polluent l'UI (le screenshot)

Deux lignes dans `tenders` ont des refs `12345` / `67890` avec `dce_url = projets-achats.marches-publics.gouv.fr/consultation/12345`. Ces consultations **n'existent pas** → le serveur PLACE renvoie `ERR_BLOCKED_BY_RESPONSE`. C'est de la donnée seed/test qui n'aurait jamais dû arriver en prod.

**Fix** : suppression de ces 2 lignes (et des `agent_runs` orphelins éventuels).

### Problème B — Mon nettoyage a été trop agressif sur 3 lignes MPI

La regex de migration `affPublication.*sans refPub` a vidé 3 lignes `scrape:mpi` qui avaient un lien sans `refPub` mais peut-être avec `IDS=…` (identifiant valide). Il faut vérifier ces 3 lignes spécifiques :

```sql
SELECT id, reference, source_url, dce_url, enriched_data->'raw'->>'dce_url' AS raw_url
FROM tenders WHERE source='scrape:mpi' AND dce_url IS NULL;
```

**Fix** : restaurer `dce_url` depuis `enriched_data->raw->dce_url` quand un identifiant valide existe (`IDS=`, `id=`, `refPub=`, `refConsult=`).

### Problème C — Pas de fallback intelligent côté front

Aujourd'hui le bouton "Accéder au DCE" disparaît si `dce_url` est null **OU** générique. Pour un AO BOAMP sans DCE direct, on **a** un `source_url` BOAMP valide qu'on pourrait afficher comme fallback ("Voir sur BOAMP").

**Fix** : 2 boutons distincts avec sémantique claire :
- "Accéder au DCE" → uniquement si `dce_url` pointe vers une vraie plateforme de retrait (PLACE, Atexo, MPI, achatpublic, etc.).
- "Voir l'avis original" → toujours visible si une URL existe (BOAMP, TED, ou plateforme), même si générique → on signale juste "page de l'avis" plutôt que de masquer.

### Problème D — Les futurs scrapes peuvent encore créer des liens cassés

Le prompt Firecrawl interdit déjà les liens hallucinés et exige un identifiant. Mais Firecrawl peut renvoyer une URL qui **a la bonne forme** mais pointe vers une consultation supprimée/expirée (404). Pas grand-chose à faire côté ingestion sans coût.

**Fix optionnel** : un job de validation périodique qui HEAD chaque `dce_url` et marque les morts dans `enriched_data.url_status = 'dead'`. Hors scope ce ticket.

## Plan d'action

### Étape 1 — Migration de réparation (SQL)

```sql
-- A. Supprimer les 2 tenders de test PLACE
DELETE FROM tenders WHERE source='scrape:place' AND reference IN ('12345','67890');

-- B. Restaurer dce_url des 3 lignes MPI vidées à tort, depuis enriched_data
UPDATE tenders
SET dce_url = enriched_data->'raw'->>'dce_url',
    source_url = COALESCE(source_url, enriched_data->'raw'->>'dce_url')
WHERE source LIKE 'scrape:%'
  AND dce_url IS NULL
  AND enriched_data->'raw'->>'dce_url' ~* '(refPub=|refConsult=|/consultation/|[?&]IDS?=\d|[?&]id=\d)';
```

### Étape 2 — Front (`src/pages/TenderDetail.tsx`)

- Affiner `isGenericLink` : ne masquer **que** les URLs sans aucun identifiant exploitable (ce que fait déjà la regex actuelle, OK).
- Le bouton "Voir l'avis original" devient **plus tolérant** : visible dès qu'une URL existe, libellé adapté (`Voir sur BOAMP` / `Voir sur TED` / `Voir l'avis original`).
- Le bouton "Accéder au DCE" reste strict : uniquement si l'URL pointe vers une vraie plateforme de retrait (pas BOAMP, pas TED qui sont des publicateurs).

```ts
const PUBLISHER_HOSTS = ['boamp.fr', 'ted.europa.eu'];
const isPublisherUrl = (u?: string|null) => !!u && PUBLISHER_HOSTS.some(h => u.includes(h));

const dceUrl = tender.dce_url && !isGenericLink(tender.dce_url) && !isPublisherUrl(tender.dce_url)
  ? tender.dce_url : null;
const officialUrl = !isGenericLink(tender.source_url) ? tender.source_url
  : !isGenericLink(tender.dce_url) ? tender.dce_url
  : null;
const officialLabel = officialUrl?.includes('boamp.fr') ? 'Voir sur BOAMP'
  : officialUrl?.includes('ted.europa.eu') ? 'Voir sur TED'
  : "Voir l'avis original";
```

### Étape 3 — Front (`src/pages/Tenders.tsx`) — vérifier la liste

S'il y a aussi un bouton "lien" sur la liste, appliquer la même logique. À confirmer en lisant le fichier.

### Étape 4 — Pas de changement aux edge functions

`upsert-tenders` fait déjà le bon filtrage (générique → null). Le prompt Firecrawl est déjà renforcé. Rien à toucher.

## Fichiers modifiés

```text
supabase/migrations/<ts>_repair_tender_urls.sql   ← suppression test + restauration
src/pages/TenderDetail.tsx                        ← logique 2 boutons distincts
src/pages/Tenders.tsx                             ← (à vérifier d'abord)
```

## Effet attendu

- Plus de tenders bidons `12345/67890` dans la liste.
- Les 3 MPI cassés retrouvent leur lien.
- Pour BOAMP/TED : "Voir sur BOAMP/TED" toujours dispo (ce sont les publicateurs officiels), bouton DCE réservé aux vraies plateformes de retrait.
- Aucune nouvelle URL fantôme à l'avenir grâce au prompt Firecrawl déjà durci.

