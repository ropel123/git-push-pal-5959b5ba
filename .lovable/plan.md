

# Agent IA pour construire le memoire technique entreprise

## Concept

Ajouter un assistant IA conversationnel dans la page Parametres qui guide l'utilisateur pour remplir son memoire technique de maniere exhaustive. L'agent pose des questions une par une (comme un entretien), et a la fin, il genere et sauvegarde automatiquement toutes les informations dans le profil.

## Ce qui change

### 1. Migration SQL — nouveaux champs memoire technique sur `profiles`

Ajouter les colonnes :
- `company_certifications text[]` — certifications (ISO 9001, Qualibat, RGE, etc.)
- `company_skills text` — competences cles (texte libre/markdown)
- `company_team text` — moyens humains (effectifs, profils cles)
- `company_equipment text` — moyens materiels et techniques
- `company_past_work text` — travaux et projets realises (texte long)

### 2. Edge function `generate-memoir` — agent conversationnel

Nouvelle edge function qui fonctionne comme un agent :
- Recoit l'historique de conversation + le profil actuel de l'entreprise
- Le system prompt demande a l'IA de jouer le role d'un consultant qui interviewe l'entreprise pour construire un memoire technique complet
- L'IA pose des questions ciblees une par une : secteur, certifications, effectifs, equipements, references, clients principaux, chiffre d'affaires, methodes qualite, engagements RSE, etc.
- Quand l'IA estime avoir assez d'informations, elle genere un JSON structure avec tous les champs du profil remplis via tool calling
- Le client recoit le JSON et sauvegarde dans `profiles`

L'agent utilise le streaming (SSE) pour une experience conversationnelle fluide.

### 3. UI — composant `MemoirAIChat` dans SettingsPage

Nouvelle carte "Memoire technique" dans la page Parametres avec :
- Un bouton "Construire mon memoire avec l'IA" qui ouvre un chat en Dialog/Sheet
- Interface de chat : messages utilisateur/assistant, input en bas, streaming des reponses
- Rendu markdown des reponses de l'IA (react-markdown)
- A la fin de l'entretien, l'IA propose un resume et un bouton "Sauvegarder" qui met a jour le profil
- Possibilite de voir/editer manuellement les champs generes avant sauvegarde

Sous le chat, affichage des champs actuels du memoire (certifications, competences, moyens, etc.) editables manuellement.

### 4. Injection dans les analyses et documents

- Modifier `analyze-tender` pour inclure le memoire technique dans le contexte envoye a l'IA (competences, certifications, moyens, references) — les analyses deviennent personnalisees
- Modifier `generate-tender-document` pour alimenter les sections du memoire technique et de la presentation avec les donnees reelles de l'entreprise au lieu de placeholders

### 5. Gestion des references entreprise

Exposer le champ `company_references` (JSONB, existe deja en base) dans la carte memoire technique :
- Liste des references existantes (titre, client, montant, date)
- Mini formulaire pour ajouter/supprimer une reference
- L'agent IA peut aussi collecter les references pendant l'entretien

## Fichiers concernes

- **Migration SQL** : ajout colonnes memoire technique
- **`supabase/functions/generate-memoir/index.ts`** : nouvel edge function agent conversationnel avec streaming
- **`src/components/MemoirAIChat.tsx`** : composant chat IA
- **`src/pages/SettingsPage.tsx`** : ajout carte memoire technique + bouton agent IA + champs editables + gestion references
- **`supabase/functions/analyze-tender/index.ts`** : injection du profil entreprise dans le prompt
- **`supabase/functions/generate-tender-document/index.ts`** : injection des donnees memoire dans la generation

## Ordre d'implementation

1. Migration SQL (colonnes memoire)
2. Edge function `generate-memoir` (agent streaming)
3. Composant `MemoirAIChat` + integration dans SettingsPage
4. Champs manuels + gestion references dans SettingsPage
5. Injection memoire dans `analyze-tender` et `generate-tender-document`

