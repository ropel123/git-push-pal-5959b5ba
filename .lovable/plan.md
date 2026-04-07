

# Améliorations documents + Assistant IA de chiffrage

## Résumé

Deux grandes évolutions :
1. **Documents plus pros** : Refonte du PPTX et PDF avec des layouts variés (couverture avec image, slides à 2 colonnes, iconographie, sommaire, stats en grand, etc.) au lieu du layout monotone actuel (titre + bloc de texte sur fond blanc).
2. **Assistant IA de chiffrage** : Un nouveau chat conversationnel (comme le mémoire technique) qui guide l'utilisateur pour construire sa réponse commerciale — prix, stratégie, décomposition par lots — en se basant sur les analyses IA déjà faites sur l'appel d'offres.

---

## 1. Documents plus professionnels

### Problème actuel
Le PPTX et le PDF ont un layout très basique : chaque section = un slide avec titre + gros bloc de texte. Pas de sommaire, pas d'images, pas de variations de layout, pas de stats en gros.

### Solution

**Edge Function `generate-tender-document`** : Enrichir le prompt pour que l'IA retourne des sections typées :
- `type: "cover"` — données de couverture
- `type: "summary"` — sommaire avec titres des sections
- `type: "content"` — texte classique
- `type: "stats"` — chiffres clés (ex: "15 ans d'expérience", "200+ projets")
- `type: "two_columns"` — contenu en 2 colonnes (ex: avantages / méthodologie)
- `type: "references"` — grille de références
- `type: "closing"` — slide de conclusion

**`generatePptx.ts`** : Ajouter des renderers par type de section :
- Slides stats avec gros chiffres (60pt) et labels
- Slides 2 colonnes avec séparateur visuel
- Slide sommaire avec numérotation
- Utilisation du logo en couverture et en footer
- Alternance de fonds (blanc / gris clair / couleur secondaire)

**`generatePdf.ts`** : Mêmes améliorations adaptées au format A4 :
- Page de sommaire
- Encadrés colorés pour les stats
- Meilleure gestion des sauts de page
- Logo en en-tête de chaque page

### Fichiers modifiés
- `supabase/functions/generate-tender-document/index.ts` — prompt enrichi + schema de tool étendu
- `src/lib/generatePptx.ts` — refonte complète des layouts
- `src/lib/generatePdf.ts` — refonte complète des layouts

---

## 2. Assistant IA de chiffrage (réponse commerciale)

### Concept
Quand un appel d'offres est au stade "En réponse" dans le pipeline, l'utilisateur peut ouvrir un chat IA dédié qui l'aide à construire sa proposition commerciale :
- L'IA a accès à toutes les analyses déjà faites sur l'AO
- Elle pose des questions sur les prix, les marges, la stratégie
- Elle aide à décomposer par lots si nécessaire
- Elle produit un récapitulatif structuré sauvegardé dans la DB

### Changements

**Nouvelle Edge Function `generate-pricing-strategy`** :
- Prompt système : expert en chiffrage de marchés publics
- Reçoit les analyses existantes + données du tender + profil entreprise
- Chat conversationnel (comme le mémoire) avec tool calling pour sauvegarder
- Tool `save_pricing` avec : prix global, décomposition par lots/postes, stratégie de marge, argumentaire prix
- Les données sauvegardées vont dans une nouvelle colonne `pricing_strategy` (jsonb) sur `pipeline_items`

**Nouveau composant `PricingChat.tsx`** :
- Similaire à `MemoirAIChat` mais contextualisé pour le chiffrage
- Accessible depuis la page TenderDetail quand l'AO est dans le pipeline au stade "En réponse"
- Affiche un résumé des analyses existantes en contexte
- Bouton "Préparer ma réponse commerciale"

**Migration DB** :
- Ajouter colonne `pricing_strategy jsonb default '{}'` sur `pipeline_items`

**Intégration dans TenderDetail** :
- Ajouter un onglet ou section "Réponse commerciale" visible quand l'AO est dans le pipeline
- Le chat IA de chiffrage s'ouvre en dialog (comme le mémoire)
- Les données sauvegardées sont affichées en cards read-only après la session

### Fichiers créés/modifiés
- `supabase/functions/generate-pricing-strategy/index.ts` — nouvelle edge function
- `src/components/PricingChat.tsx` — nouveau composant chat
- `src/pages/TenderDetail.tsx` — intégration du bouton + affichage pricing
- Migration SQL — colonne `pricing_strategy` sur `pipeline_items`

---

## Ordre d'implémentation

1. Migration DB (ajout colonne pricing_strategy)
2. Edge Function `generate-pricing-strategy`
3. Composant `PricingChat.tsx`
4. Intégration dans TenderDetail
5. Refonte du prompt de `generate-tender-document` (sections typées)
6. Refonte `generatePptx.ts` (layouts variés)
7. Refonte `generatePdf.ts` (layouts variés)

