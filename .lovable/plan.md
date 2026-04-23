

# Suppression totale — Sourcing + Appels d'offres

## Périmètre

Wipe complet via migration SQL (DELETE, pas DROP — les tables et schémas restent).

## Données effacées

| Table | Lignes actuelles | Raison |
|---|---|---|
| `sourcing_urls` | 77 | demande directe |
| `tenders` | 1252 | demande directe |
| `award_notices` | 124 | rattaché aux tenders |
| `tender_analyses` | 0 | rattaché aux tenders |
| `pipeline_items` | 0 | rattaché aux tenders |
| `pipeline_comments` | 0 | rattaché aux pipeline_items |
| `dce_downloads` | 5 | rattaché aux tenders |
| `dce_uploads` | 5 | rattaché aux tenders |
| `agent_runs` | 4 | rattaché aux tenders |
| `scrape_logs` | 109 | rattaché aux sourcing_urls |
| `ingest_cursors` | 0 | rattaché aux sourcing_urls |

## Données préservées

- `profiles`, `user_roles`, `agent_anonymous_identity`, `agent_playbooks`, `platform_robots`, `platform_fingerprints`, `alerts`, `saved_searches` → intacts.
- Buckets storage `dce-documents` / `company-assets` → **non touchés** par cette migration. Si tu veux purger aussi les fichiers DCE physiques dans le bucket, dis-le, je le ferai séparément (la suppression des lignes `dce_downloads`/`dce_uploads` ne supprime pas les blobs).

## Migration SQL (ordre = dépendances logiques d'abord)

```sql
DELETE FROM pipeline_comments;
DELETE FROM pipeline_items;
DELETE FROM tender_analyses;
DELETE FROM dce_downloads;
DELETE FROM dce_uploads;
DELETE FROM agent_runs;
DELETE FROM award_notices;
DELETE FROM tenders;

DELETE FROM scrape_logs;
DELETE FROM ingest_cursors;
DELETE FROM sourcing_urls;
```

Pas de FK déclarées entre ces tables, donc aucun risque d'erreur de contrainte — l'ordre est juste là pour rester cohérent.

## Effet UI attendu

- `/sourcing` : liste vide ("URLs configurées (0)").
- `/tenders` : "0 résultat(s)".
- `/pipeline`, `/awards`, `/activity` : vides.
- Le scheduler tourne toujours mais n'a plus rien à faire tant qu'on n'ajoute pas de nouvelles URLs.

## Confirmation requise

Action **destructive et irréversible** (1252 AO + 77 URLs + 124 attributions + 109 logs). Approuve le plan pour que je lance la migration.

