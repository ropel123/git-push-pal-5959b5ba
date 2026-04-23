

# Wipe sourcing — passe 2

Tu veux re-vider la table `sourcing_urls` (et ses logs associés) qui s'est repeuplée pendant les tests d'import.

## Ce qui sera effacé

| Table | Raison |
|---|---|
| `sourcing_urls` | demande directe — tous les liens supprimés |
| `scrape_logs` | rattaché aux URLs supprimées |
| `ingest_cursors` | rattaché aux URLs supprimées |

## Ce qui est préservé

- `tenders`, `award_notices`, `pipeline_items`, `dce_*`, `agent_runs` → intacts (déjà à 0 depuis le wipe précédent de toute façon).
- `profiles`, `user_roles`, `agent_playbooks`, `platform_*`, `alerts`, `saved_searches` → intacts.

## Migration SQL

```sql
DELETE FROM scrape_logs;
DELETE FROM ingest_cursors;
DELETE FROM sourcing_urls;
```

Pas de FK, ordre purement cosmétique.

## Effet UI attendu

- `/sourcing` : "URLs configurées (0)".
- Les autres pages CRM/Tenders : déjà vides, inchangées.

Approuve pour que je lance la migration.

