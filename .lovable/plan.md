

# Enrichir l'assistant de chiffrage avec le profil complet + analyses

## Problème

Le contexte envoyé à l'IA dans `generate-pricing-strategy` est incomplet. Il manque :
- **Certifications** (ISO, Qualibat, etc.)
- **Références / projets passés** (avec montants, clients)
- **Expériences passées** (`company_past_work`)
- **Description de l'entreprise**
- **Taille, SIREN, régions, mots-clés**
- **Conditions de participation** et **localisation d'exécution** côté tender
- **Données DCE enrichies** si disponibles

L'IA ne peut pas bien guider la personne si elle ne connaît pas le profil complet.

## Changements

### 1. Enrichir le contexte prompt (`generate-pricing-strategy/index.ts`)

**Aussi fetcher les DCE enrichies** pour cet AO (table `dce_downloads` avec `enriched_data`).

**Section ENTREPRISE complétée** avec tous les champs du profil :

```
ENTREPRISE :
- Nom : ...
- SIREN : ...
- Taille : ...
- Description : ...
- Secteurs : ...
- Régions : ...
- Mots-clés : ...
- Compétences : ...
- Certifications : ...
- Moyens humains : ...
- Moyens matériels : ...
- Expériences passées : ...
- Références projets : [JSON des références avec client, montant, description]
```

**Section APPEL D'OFFRES complétée** avec les champs manquants :

```
- Conditions de participation : ...
- Lieu d'exécution : ...
- Type de contrat : ...
- Type de procédure : ...
- Codes CPV : ...
```

**Section DCE** (si des documents enrichis existent) :

```
DONNÉES DCE ENRICHIES :
[contenu enriched_data des DCE téléchargées]
```

### 2. Enrichir le system prompt

Ajouter des instructions pour que l'IA :
- Exploite activement les références similaires pour calibrer les prix
- Compare les certifications détenues vs celles potentiellement requises
- Utilise la taille de l'entreprise et les expériences passées pour ajuster les marges
- Mentionne les forces du profil comme arguments commerciaux dans le `pricing_arguments`

### 3. Redéployer la fonction

Un seul fichier modifié : `supabase/functions/generate-pricing-strategy/index.ts`, puis déploiement.

## Fichier modifié
- `supabase/functions/generate-pricing-strategy/index.ts`

