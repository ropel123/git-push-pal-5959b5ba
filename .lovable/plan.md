

# Lancer la classification IA de toutes les URLs de sourcing

## Action

Appel one-shot de l'edge function `reclassify-sourcing-urls` sur les **130 URLs** de la table `sourcing_urls`, sans filtre, avec `force: true` côté `resolvePlatform` (déjà le comportement par défaut de cette function).

## Comment

Depuis l'UI `/sourcing` (admin), bouton **"Reclassifier (via IA)"** déjà branché → click → `supabase.functions.invoke('reclassify-sourcing-urls', { body: {} })`.

Body vide = toutes les URLs (pas de filtre `only_custom`, pas d'`sourcing_url_id`).

## Déroulé attendu

1. Function itère sur les 130 lignes.
2. Pour chaque URL : `resolvePlatform(url, supabase, { force: true })` → bypass cache → fetch HTML 8 ko → appel Claude 3.5 Sonnet via OpenRouter (tool calling enum fermé).
3. Update de `sourcing_urls.platform` + `metadata.platform_evidence` / `platform_source` / `platform_confidence` / `platform_detected_at` / `pagination_hint`.
4. Cache écrit dans `platform_fingerprints` (24 h TTL par hostname).

## Durée et coût estimés

- **~5-8 min** en série (130 × ~2-3 s par appel Claude).
- **~$1.30** côté OpenRouter (Claude 3.5 Sonnet, 130 × ~3 200 tokens in + 200 tokens out).
- Aucun crédit Firecrawl consommé (juste un GET HTTP direct).

## Suivi pendant le run

- Logs en direct : Edge Functions → `reclassify-sourcing-urls` → Logs.
- À la fin : retour JSON avec récap `{ ok, processed: 130, by_source: { ai: N, hostname: M, ... }, results: [...] }`.

## Vérification après run

Une fois terminé, requête de contrôle pour voir la nouvelle répartition par plateforme (avant : 76 `custom` / 130). Objectif : tomber à ~5-10 `custom`, le reste réparti sur `atexo`, `mpi`, `omnikles`, `aws`, `domino`, etc.

## Fichiers touchés

Aucun. Toute la mécanique est déjà en place depuis le run précédent. C'est juste un déclenchement.

## Risques

- **Timeout edge function** (limite ~60 s par défaut sur Supabase) : 130 appels × 2-3 s = 260-400 s → **dépassement quasi certain**. Il faut soit :
  - **Option A (recommandée)** : batcher côté client — boucler 5 par 5 en appelant la function avec `sourcing_url_id` une URL à la fois (plus lent mais résilient).
  - **Option B** : ajouter un mode batch côté function (`{ batch_size: 5, offset: N }`) et boucler côté client.
  - **Option C** : laisser tel quel, accepter l'échec partiel, relancer.

Je pars sur **Option A** : modification mineure du bouton `/sourcing` pour boucler côté client URL par URL avec une barre de progression et un toast final, au lieu d'un seul appel monolithique qui va timeout.

## Plan d'exécution

1. Récupérer la liste des 130 `sourcing_urls.id` côté front (admin).
2. Boucler avec `Promise` séquentiel + concurrence 3 max : pour chaque ID, `supabase.functions.invoke('reclassify-sourcing-urls', { body: { sourcing_url_id: id } })`.
3. Afficher progress live (X / 130) + compteur par plateforme en temps réel.
4. Toast final : `130 traitées, dont N par IA, M restent custom`.
5. Refresh de la liste affichée.

Aucune migration SQL, aucune nouvelle function. Juste un patch front sur `src/pages/Sourcing.tsx` (handler du bouton existant).

