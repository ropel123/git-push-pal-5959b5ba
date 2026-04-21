

# Reset complet de la base de données

## Ce que tu demandes

Vider toutes les données métier pour repartir de zéro, tout en gardant :
- Le schéma des tables (structure)
- Ton compte utilisateur et ton profil
- Ton rôle admin
- Les 10 URLs de sourcing validées
- Les secrets et buckets storage

## Ce qui sera supprimé

| Table | Contenu effacé |
|---|---|
| `tenders` | ~19 665 AO référencés |
| `awards` | Tous les attributaires |
| `buyers` | Tous les acheteurs |
| `pipeline_items` | Ton pipeline (1 item) |
| `saved_searches` | Recherches sauvegardées (peinture, etc.) |
| `dce_downloads` | Historique téléchargements DCE |
| `tender_analyses` | Analyses IA |
| `pricing_strategies` | Stratégies de chiffrage |
| `memoir_sessions` / `memoir_messages` | Conversations mémoire technique |
| `generated_documents` | PDF/PPTX générés |
| `notifications` | Notifications |
| `activity_logs` | Historique d'activité |
| `sourcing_runs` / `sourcing_logs` | Logs des runs de scraping |
| Bucket `dce-documents` | Tous les fichiers DCE stockés |

## Ce qui sera conservé

- `auth.users` → ton compte
- `profiles` → ton profil
- `user_roles` → ton rôle admin
- `sourcing_urls` → les 10 plateformes validées (prêtes à re-scraper)
- `company_profile` / `company_assets` → ton onboarding entreprise
- Bucket `company-assets` → ton logo/charte

## Comment

**1 migration SQL unique** avec :
- `TRUNCATE ... RESTART IDENTITY CASCADE` sur les tables métier
- Reset des compteurs `last_run_at` / `last_success_at` / `total_items_found` sur `sourcing_urls` (pour repartir propre côté UI)
- Suppression des objets du bucket `dce-documents` via `DELETE FROM storage.objects WHERE bucket_id = 'dce-documents'`

## Vérifications avant exécution

Je vais d'abord (au moment de l'exécution, pas maintenant) :
1. Lister toutes les tables réellement présentes via `supabase--read_query` pour ne rien oublier
2. Confirmer que `company_profile` existe bien (sinon je l'ignore)
3. Construire le `TRUNCATE` sur la liste exacte

## Après le reset

Tu pourras :
- Aller sur `/sourcing` → les 10 URLs sont là, compteurs à 0
- Lancer un run manuel sur chacune ou attendre le cron 6h
- Le dashboard `/dashboard` affichera 0 partout jusqu'au premier scrape

⚠️ **Action irréversible.** Une fois la migration appliquée, les 19 665 AO et ton historique sont perdus. Confirme avec "Approve" pour que je lance la migration.

