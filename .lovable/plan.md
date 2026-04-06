

# Audit technique : Telechargement automatique des DCE + Agent IA

## Analyse des plateformes DCE en base

Sur **13 027 AO**, **5 232** ont une `dce_url` exploitable (avec un identifiant de consultation). Repartition :

```text
Plateforme                          | AO    | Auth requise | Acces anonyme DCE
------------------------------------|-------|--------------|-------------------
MPI/AWS (marches-publics.info)      | 1 800 | Oui + CAPTCHA| Oui ("mode anonyme")
PLACE (marches-publics.gouv.fr)     | 1 083 | Oui          | RC telechargeable sans auth
AchatPublic                         |   785 | Oui          | "Pieces de marche" visible, download = auth
e-marchespublics.com                |    99 | Oui          | Boutons "Dossier"/"RC" visibles, download = auth
Marches-securises.fr                |   404 | Oui          | Non (URLs generiques sans ID)
Maximilien                          |   246 | Oui          | Non
Xmarches                            |    62 | Oui          | Non
demat-ampa, megalis, ternum, etc.   |   753 | Oui          | Non
```

### Constats cles

1. **MPI/AWS** : A un lien "retirer le DCE en mode anonyme" — potentiellement exploitable sans authentification
2. **PLACE** : Propose un lien direct `Telecharger le RC` (Reglement de Consultation) en acces libre — l'URL est constructible : `marches-publics.gouv.fr/index.php?page=Entreprise.EntrepriseDownloadReglement&id={base64_id}&orgAcronyme={acro}`
3. **AchatPublic** : La page de detail est accessible sans auth (description, Q&R visibles), mais le telechargement des pieces necessite une session
4. **e-marchespublics** : Idem, la page de detail est ouverte mais le dossier est protege
5. **Beaucoup d'URLs sont generiques** (juste le domaine, sans ID de consultation) — inexploitables

## Strategie d'implementation : Agent DCE hybride

### Architecture proposee

```text
┌──────────────────────────────────────────┐
│            Frontend (TenderDetail)        │
│  [Telecharger DCE automatiquement]       │
│  [Uploader manuellement]  (fallback)     │
└────────────────┬─────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────┐
│     Edge Function: fetch-dce             │
│                                          │
│  1. Detecte la plateforme (regex URL)    │
│  2. Route vers le bon "adapter"          │
│  3. Tente le telechargement              │
│  4. Si echec → renvoie "manual_required" │
│  5. Si OK → stocke dans Storage          │
└──────────────────────────────────────────┘
```

### Phase 1 — Adapteurs par plateforme (Edge Function `fetch-dce`)

Chaque plateforme a un adapteur qui tente de recuperer le DCE sans interaction humaine :

**Adapteur PLACE (marches-publics.gouv.fr)** — Priorite haute (18% des DCE)
- Le RC est telechargeable via un lien direct constructible a partir de l'ID
- On extrait l'`id` et `orgAcronyme` de l'URL, on encode l'id en base64, et on fetch le PDF directement
- Aucune auth necessaire pour le RC

**Adapteur MPI/AWS (marches-publics.info)** — Priorite haute (28% des DCE)
- Mode anonyme disponible : on scrape la page pour trouver le lien "retirer le DCE en mode anonyme"
- Utilise Firecrawl pour naviguer la page et extraire le lien de telechargement
- CAPTCHA present = risque d'echec, fallback vers upload manuel

**Adapteur AchatPublic** — Priorite moyenne (13%)
- Scrape la page de detail pour extraire les metadonnees enrichies (description, Q&R, lots)
- Telechargement DCE = auth requise → fallback upload manuel
- Mais on enrichit le tender avec les infos scraped

**Adapteur generique (Firecrawl)** — Pour toutes les autres plateformes
- Utilise Firecrawl pour scraper la page du DCE
- Extrait le maximum d'informations textuelles (description detaillee, lots, criteres)
- Tente de trouver des liens de telechargement directs
- Si aucun lien direct → fallback upload manuel

### Phase 2 — Table et stockage

**Migration SQL** :
- Table `dce_downloads` pour tracker les tentatives de telechargement automatique (statut, plateforme, erreur)
- Utilise le bucket `dce-documents` existant

### Phase 3 — UI dans TenderDetail

- Bouton **"Recuperer le DCE"** qui appelle `fetch-dce`
- Etats : "En cours..." → "Telecharge !" ou "Non disponible automatiquement, uploadez manuellement"
- Affichage du resultat (fichiers recuperes vs. infos enrichies)
- Fallback vers le composant `DceUploadSection` existant

### Phase 4 — Enrichissement des donnees tender

Meme quand le DCE n'est pas telechargeable, l'agent peut enrichir les donnees :
- Scraper la description complete, les lots detailles, les Q&R publiques
- Stocker ces infos supplementaires dans un champ `enriched_data` (JSONB) sur le tender
- Utiliser ces donnees enrichies pour l'analyse IA (meilleure qualite de memoire technique)

## Prerequis

1. **Connecteur Firecrawl** : a activer via `standard_connectors--connect` pour le scraping des plateformes complexes
2. **Table `dce_downloads`** : migration DB pour tracker les telechargements automatiques

## Fichiers a creer/modifier

- `supabase/functions/fetch-dce/index.ts` — nouvelle Edge Function avec adapteurs par plateforme
- `src/components/DceAutoFetchButton.tsx` — bouton de telechargement automatique
- `src/pages/TenderDetail.tsx` — integration du bouton
- Migration SQL pour `dce_downloads` + colonne `enriched_data` sur `tenders`

## Limites et risques

- **CAPTCHA** : MPI/AWS a des CAPTCHAs — le mode anonyme peut ne pas marcher a 100%
- **Rate limiting** : les plateformes peuvent bloquer si trop de requetes
- **URLs generiques** : ~20% des `dce_url` sont juste un domaine sans ID = inexploitables
- **Legalite** : le scraping de contenu public est legal en France (droit a la copie privee), mais le contournement d'auth est plus discutable — on se limite aux acces publics/anonymes

