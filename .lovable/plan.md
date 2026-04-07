

# Refonte complète de la page Paramètres

## Résumé

Restructurer la page Settings avec une navigation par onglets (Tabs) pour organiser les sections de manière claire, et mettre le chat IA mémoire technique au centre de l'expérience plutôt qu'en bouton secondaire. Les champs manuels du mémoire (compétences, moyens, etc.) deviennent en lecture seule, remplis par l'IA.

## Changements

### 1. Navigation par onglets
**Fichier** : `src/pages/SettingsPage.tsx`

Remplacer le scroll vertical monolithique par un layout avec `Tabs` (composant existant) :
- **Profil entreprise** : nom, SIREN, taille, site web, description, secteurs, régions, mots-clés
- **Mémoire technique** : le chat IA en pleine section + affichage read-only des données collectées (certifications, compétences, moyens, références) avec un bouton "Mettre à jour avec l'IA"
- **Identité visuelle** : logo, couleurs primaire/secondaire
- **Alertes** : gestion des alertes de veille

Chaque onglet a son propre bouton "Enregistrer" quand pertinent.

### 2. Onglet Mémoire technique repensé
- En haut : le composant `MemoirAIChat` en mode dialog (comme actuellement) avec un CTA plus visible
- En dessous : les données du mémoire affichées en sections read-only (cards) avec les infos déjà collectées par l'IA
- Les champs textarea manuels (compétences, moyens humains, etc.) restent éditables mais sont pré-remplis par l'IA
- La section références reste éditable manuellement

### 3. Onglet Profil entreprise simplifié
- Regrouper les infos entreprise (nom, SIREN, taille, site web, description) et les préférences de veille (secteurs, régions, mots-clés) dans le même onglet
- Layout plus aéré avec des sous-sections visuellement séparées

### 4. Onglet Identité visuelle
- Logo upload avec preview plus grand
- Sélecteurs de couleurs avec preview en temps réel (mini-card de preview montrant l'apparence des documents générés)

### 5. Onglet Alertes
- Identique à l'actuel, juste isolé dans son propre onglet

## Détails techniques

- Utilise `src/components/ui/tabs.tsx` déjà présent dans le projet
- Pas de changement de logique métier — même `handleSave`, même state
- Le state est splitté par onglet pour des saves indépendants
- Aucune migration DB nécessaire

## Résultat attendu

- Page Settings organisée et navigable par onglets
- Le mémoire technique IA est mis en avant comme outil principal
- Les données collectées sont visibles en lecture après la session IA
- L'utilisateur peut toujours éditer manuellement si besoin

