

# Refonte UI Analyses IA + Branding Onboarding + Generation de documents

Ce plan couvre 3 chantiers interconnectes : ameliorer l'affichage des analyses, enrichir le profil entreprise avec le branding, et permettre la generation de PDF/PPTX de reponse aux appels d'offres.

---

## Chantier 1 — Refonte UI de la section Analyse IA

**Fichier : `src/components/TenderAnalysisSection.tsx`**

Probleme actuel : les resultats sont affiches en texte brut dans un bloc scrollable, l'historique est cache derriere un toggle, et le rendu markdown n'est pas supporte.

Modifications :
1. **Tabs par type d'analyse** : remplacer la liste plate par des onglets (Analyse rapide / Memoire technique / Recommandations) avec un compteur de resultats par tab
2. **Rendu Markdown** : installer `react-markdown` et rendre le contenu avec formatage (titres, listes, gras) au lieu du `whitespace-pre-wrap`
3. **Resultat en pleine page** : cliquer sur une analyse passee l'ouvre dans un Dialog plein ecran (pas juste un `line-clamp-3`)
4. **Actions sur chaque analyse** : Copier, Telecharger en .txt, Generer un document (lien vers chantier 3)
5. **Suppression de l'historique cache** : toutes les analyses sont visibles directement dans leur tab respective, triees par date

---

## Chantier 2 — Enrichir l'onboarding avec le branding entreprise

**Migration SQL** : ajouter des colonnes a la table `profiles` :
- `company_logo_path text` — chemin vers le logo dans le bucket storage
- `company_description text` — description courte de l'entreprise
- `company_website text` — site web
- `primary_color text` — couleur principale (hex)
- `secondary_color text` — couleur secondaire (hex)
- `company_references jsonb DEFAULT '[]'` — references/projets passes (titre, client, montant, date)

**Bucket storage** : creer un bucket `company-assets` (prive) pour stocker logos et documents de l'entreprise.

**Fichier : `src/pages/Onboarding.tsx`** — ajouter une etape 5 "Identite visuelle" :
- Upload du logo (drag & drop vers `company-assets`)
- Couleurs primaire/secondaire (color picker)
- Description de l'entreprise (textarea)
- Site web (input URL)

**Fichier : `src/pages/SettingsPage.tsx`** — permettre de modifier ces champs apres l'onboarding.

---

## Chantier 3 — Generation de documents de reponse (PDF + PPTX)

### 3a. Edge function `generate-tender-document`

**Fichier : `supabase/functions/generate-tender-document/index.ts`**

Cette fonction :
1. Recoit `{ tender_id, document_type: "pdf" | "pptx", template: "memoire_technique" | "presentation" }`
2. Recupere les donnees du tender, le profil entreprise (logo, couleurs, description, references), et les analyses IA existantes
3. Appelle Lovable AI (gemini-2.5-flash) pour generer le contenu structure (JSON) adapte au template choisi
4. Retourne le contenu structure au client

### 3b. Generation cote client

**Nouveaux fichiers :**
- `src/lib/generatePdf.ts` — utilise `jspdf` ou appelle une edge function dediee pour creer le PDF avec le branding
- `src/lib/generatePptx.ts` — utilise `pptxgenjs` pour creer la presentation PowerPoint

Les documents incluront :
- Page de garde avec logo, nom de l'entreprise, titre du marche
- Couleurs de la charte graphique appliquees
- Sections structurees (comprehension du besoin, methodologie, moyens, planning, references)
- Les analyses IA pre-remplissent le contenu

### 3c. UI — Bouton "Generer un document"

**Fichier : `src/components/TenderAnalysisSection.tsx`** (ou nouveau composant `TenderDocumentGenerator.tsx`)

- Bouton "Generer un document de reponse" dans la section analyse
- Dialog de configuration : choix du format (PDF/PPTX), choix du template, options (inclure references, lots specifiques)
- Barre de progression pendant la generation
- Telechargement automatique du fichier genere

---

## Ordre d'implementation

1. **Migration SQL** — colonnes branding sur `profiles` + bucket `company-assets`
2. **Onboarding enrichi** — etape 5 identite visuelle
3. **Refonte UI analyses** — tabs, markdown, actions
4. **Edge function generation** — `generate-tender-document`
5. **Generation PDF/PPTX client** — librairies + UI

## Dependances npm a installer

- `react-markdown` — rendu markdown des analyses
- `pptxgenjs` — generation PowerPoint cote client
- `jspdf` — generation PDF cote client (ou alternative serveur)

