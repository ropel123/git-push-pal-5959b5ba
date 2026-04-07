

# Mise à jour du prompt mémoire technique

## Résumé

Remplacer le `SYSTEM_PROMPT` actuel (lignes 10-99) dans `supabase/functions/generate-memoir/index.ts` par le nouveau prompt fourni, qui est plus structuré avec des relances automatiques sur les réponses vagues et une rédaction progressive thème par thème.

## Changement

**Fichier** : `supabase/functions/generate-memoir/index.ts`

1. Remplacer le contenu de `SYSTEM_PROMPT` (lignes 10-99) par le prompt exact fourni, qui couvre :
   - Posture d'expert en appels d'offres
   - Une question à la fois, relances automatiques sur le vague
   - 10 thèmes structurés (présentation, certifications, compétences, moyens humains, moyens matériels, méthodologie, QSE, références, organisation marché visé, éléments différenciants)
   - Pour chaque thème : question ouverte → relance → résumé pro + points forts + manques
   - Synthèse finale avec trame de mémoire et première version rédigée

2. Redéployer la Edge Function `generate-memoir`

Aucun changement UI, aucun changement de modèle, aucun changement de tool calling.

