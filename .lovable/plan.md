

# Matching mémoire technique ↔ analyses IA + scoring enrichi

## Résumé

Deux améliorations :
1. **Prompts IA enrichis** : les 3 types d'analyse (rapide, mémoire technique, stratégie) utilisent déjà les données profil, mais les prompts ne demandent pas explicitement de faire le matching. On met à jour les prompts pour que l'IA compare activement les exigences de l'AO aux compétences/certifications/références de l'entreprise.
2. **Scoring enrichi** : le `computeScore` actuel n'utilise que keywords/regions/CPV/montant. On ajoute des critères basés sur les données du mémoire IA (certifications, compétences, références).

## Changements

### 1. Enrichir les prompts d'analyse (`analyze-tender/index.ts`)

Les 3 prompts sont mis à jour pour inclure des instructions de matching explicites :

- **Analyse rapide** : ajouter "Compare les exigences de l'AO avec le profil de l'entreprise candidate. Indique le taux de correspondance sur : compétences, certifications requises vs détenues, zone géographique, références similaires, capacité financière."
- **Mémoire technique** : remplacer les `[À COMPLÉTER]` par les vraies données du profil quand disponibles (compétences, moyens humains/matériels, certifications, références). L'IA rédige directement avec les infos de l'entreprise au lieu de mettre des placeholders.
- **Stratégie** : ajouter "Analyse les forces et faiblesses de l'entreprise candidate par rapport à cet AO. Identifie les gaps de compétences ou certifications manquantes."

### 2. Enrichir le scoring (`src/lib/scoring.ts`)

Ajouter 3 nouveaux critères au scoring (redistribution des poids) :

- **Certifications** (poids 10) : si l'AO mentionne des certifications (ISO, Qualibat, etc.) dans son texte et que le profil les a → points
- **Compétences** (poids 10) : matching texte entre `company_skills` et le texte de l'AO
- **Références** (poids 5) : si des références existent dans le profil, bonus de crédibilité

Nouveaux poids : Keywords 25, Région 20, CPV 15, Montant 10, Certifications 10, Compétences 15, Références 5 = 100

L'interface `ProfileForScoring` est étendue avec `company_certifications`, `company_skills`, `company_references`.

### 3. Passer le profil complet au scoring

**Fichier** : `src/pages/TenderDetail.tsx` (et partout où `computeScore` est appelé)

S'assurer que le profil passé à `computeScore` inclut les nouveaux champs du mémoire.

## Fichiers modifiés
- `supabase/functions/analyze-tender/index.ts` — prompts enrichis avec instructions de matching
- `src/lib/scoring.ts` — nouveaux critères + nouvelles pondérations
- `src/pages/TenderDetail.tsx` — passer profil complet au scoring
- `src/pages/Tenders.tsx` — idem si scoring utilisé dans la liste

## Résultat attendu
- Les analyses IA mentionnent explicitement les correspondances entre l'entreprise et l'AO
- Le mémoire technique est pré-rédigé avec les vraies infos de l'entreprise
- Le score de pertinence prend en compte les certifications, compétences et références
- Plus le mémoire IA est rempli, plus le scoring et les analyses sont pertinents

