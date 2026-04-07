

# Onboarding par IA + Analyse du site web

## Concept

Remplacer l'onboarding formulaire 5 étapes par le chat mémoire IA en pleine page. L'IA devient le seul point d'entrée : elle collecte les infos entreprise, analyse le site web si fourni, construit le mémoire technique, et sauvegarde tout. Ensuite, ces données alimentent le scoring automatique des appels d'offres.

## Changements

### 1. Edge Function : scraper le site web + enrichir le tool
**Fichier** : `supabase/functions/generate-memoir/index.ts`

- Ajouter un tool `analyze_website` que l'IA peut appeler quand l'utilisateur donne son URL :
  - La function fetch le site, extrait le texte (HTML → texte brut)
  - Renvoie le contenu au LLM comme contexte
- Enrichir le tool `save_memoir` avec les champs entreprise : `company_name`, `siren`, `company_size`, `sectors` (array), `regions` (array), `keywords` (array), `company_website`, `company_description`
- Adapter le prompt pour que l'IA demande l'URL du site dès le début et l'analyse automatiquement si fourni

### 2. Refonte Onboarding
**Fichier** : `src/pages/Onboarding.tsx`

- Remplacer le formulaire 5 étapes par :
  - Un écran d'accueil avec titre "Bienvenue ! Notre IA va construire votre profil"
  - Le composant `MemoirAIChat` intégré en pleine page (pas en dialog)
  - Un lien "Passer cette étape" qui redirige vers `/dashboard` avec `onboarding_completed: true`

### 3. Adapter MemoirAIChat pour le mode onboarding
**Fichier** : `src/components/MemoirAIChat.tsx`

- Ajouter prop `mode: "dialog" | "onboarding"` (default `"dialog"`)
- Mode onboarding : pas de `<Dialog>` wrapper, rendu pleine page, le bouton "Sauvegarder" marque aussi `onboarding_completed: true`
- Étendre `MemoirData` avec les champs entreprise
- Dans `handleSaveMemoir`, sauvegarder les champs entreprise + onboarding_completed

### 4. Mini-step branding après le chat
**Fichier** : `src/pages/Onboarding.tsx`

- Après sauvegarde du mémoire, afficher un écran compact avec :
  - Upload logo
  - Couleur principale / secondaire
  - Bouton "Terminer" → redirect `/dashboard`
- Optionnel, skip possible

### 5. Prompt enrichi
Dans le `SYSTEM_PROMPT`, ajouter en début de conversation :
- Demander le nom de l'entreprise, le SIREN, la taille, le site web
- Si site web fourni → appeler `analyze_website` et utiliser le contenu pour pré-remplir la description, identifier les certifications, compétences, références visibles
- Enchaîner ensuite sur les 10 thèmes du mémoire technique

## Détails techniques

- L'analyse du site web se fait via un simple `fetch()` côté Edge Function (pas de headless browser), extraction du texte HTML via regex/strip tags
- Le contenu du site est injecté comme contexte dans la conversation, pas stocké en DB
- Aucune migration DB nécessaire — tous les champs existent déjà dans `profiles`
- Le scoring automatique des AO utilise déjà les données `profiles` (sectors, regions, keywords) — une fois remplies par l'IA, le scoring fonctionne immédiatement

## Résultat attendu

- L'utilisateur arrive sur l'onboarding, parle à l'IA
- L'IA analyse son site web, pose des questions ciblées, collecte tout
- En un clic, tout est sauvegardé (infos entreprise + mémoire technique)
- Le dashboard est immédiatement opérationnel avec scoring personnalisé

