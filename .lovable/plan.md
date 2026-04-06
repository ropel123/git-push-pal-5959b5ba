

# Audit technique des plateformes DCE + Plan d'integration IA

## Audit des plateformes DCE dans la base

Sur **13 027 AO** en base, **6 524** (50%) ont une `dce_url`. Voici la repartition par plateforme :

```text
Plateforme              | AO    | % du total DCE
------------------------|-------|---------------
MPI/AWS (marches-publics.info) | 1 845 | 28%
PLACE (marches-publics.gouv.fr)| 1 159 | 18%
AchatPublic             |   851 | 13%
Marches-securises.fr    |   479 |  7%
e-marchespublics.com    |   472 |  7%
Maximilien              |   258 |  4%
SafeTender              |   104 |  2%
Xmarches                |    67 |  1%
Autres (megalis, klekoon, demat-ampa, marchespublics596280...) | 1 289 | 20%
```

### Constat technique par plateforme

**Toutes ces plateformes exigent une inscription gratuite** pour telecharger les DCE. Aucune ne propose de lien direct vers un ZIP/PDF sans authentification. Le telechargement automatique est donc **impossible sans simuler une session authentifiee** (Puppeteer/Playwright), ce qui pose des problemes de :
- Maintenance (chaque plateforme a son propre formulaire)
- Legalite (scraping de contenu protege)
- CAPTCHAs et rate-limiting

### Strategie recommandee : Upload manuel du DCE par l'utilisateur

Au lieu de tenter le telechargement automatique (complexe, fragile, couteux), la strategie pragmatique est :

1. **Rediriger l'utilisateur** vers la plateforme DCE (bouton existant "Acceder au DCE")
2. **L'utilisateur telecharge le DCE** lui-meme sur la plateforme (inscription gratuite)
3. **L'utilisateur uploade le DCE chez nous** via un formulaire d'upload
4. **L'IA analyse le DCE** et genere la proposition

---

## Plan d'implementation

### Phase 1 — Infrastructure de stockage des DCE uploades

**Migration SQL** : Creer un bucket Supabase Storage `dce-documents` et une table `dce_uploads` pour tracker les fichiers :

```sql
-- Bucket storage
INSERT INTO storage.buckets (id, name, public) VALUES ('dce-documents', 'dce-documents', false);

-- Table de suivi
CREATE TABLE dce_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id uuid REFERENCES tenders(id) NOT NULL,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE dce_uploads ENABLE ROW LEVEL SECURITY;
-- RLS : users voient leurs propres uploads
```

Policies RLS sur le bucket et la table pour que chaque user accede uniquement a ses fichiers.

### Phase 2 — UI d'upload dans TenderDetail

Ajouter dans `TenderDetail.tsx` :
- Un bouton **"Uploader le DCE"** (icone Upload) a cote du bouton "Acceder au DCE"
- Un dropzone qui accepte PDF/ZIP/DOCX (max 50MB)
- Affichage des fichiers deja uploades pour cet AO
- Possibilite de supprimer un fichier uploade

### Phase 3 — Edge function `analyze-tender` (IA via OpenRouter)

Creer `supabase/functions/analyze-tender/index.ts` :
- Recoit : `tender_id`, `user_id`, `analysis_type`
- Recupere les infos du tender + les fichiers DCE uploades depuis Storage
- Parse les PDFs (extraction texte)
- Appelle OpenRouter (`anthropic/claude-sonnet-4`) avec un prompt structure
- Types d'analyse :
  - **Analyse rapide** : resume, go/no-go, points cles
  - **Memoire technique** : brouillon structure complet
  - **Recommandations** : strategie de reponse
- Stocke le resultat dans `tender_analyses`

**Table `tender_analyses`** :
```sql
CREATE TABLE tender_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id uuid REFERENCES tenders(id) NOT NULL,
  user_id uuid NOT NULL,
  analysis_type text NOT NULL,
  result text,
  model_used text,
  tokens_used integer,
  created_at timestamptz DEFAULT now()
);
```

### Phase 4 — UI d'analyse IA dans TenderDetail

- Bouton **"Analyser avec l'IA"** (visible quand des DCE sont uploades ou que l'AO a assez d'infos)
- Modal avec choix du type d'analyse
- Affichage du resultat en markdown (avec ReactMarkdown)
- Boutons copier / telecharger en PDF
- Historique des analyses precedentes

### Phase 5 — Systeme de paiement (service 490€)

- Page `/services` avec les packs (deja prevue dans PricingSection)
- Table `service_requests` pour les demandes payantes
- Integration Stripe pour le paiement
- Workflow : paiement → l'equipe recoit la demande → revue du dossier IA → livraison

## Secret requis

- `OPENROUTER_API_KEY` : a ajouter via l'outil secrets avant de coder l'edge function

## Fichiers crees/modifies

- Migration SQL (bucket + 2 tables + RLS)
- `supabase/functions/analyze-tender/index.ts` (nouveau)
- `src/pages/TenderDetail.tsx` (upload DCE + bouton IA + affichage resultats)
- `src/lib/api/analyze.ts` (nouveau — client API pour l'edge function)

## Ordre d'execution

1. Migration DB (bucket + tables)
2. UI upload DCE dans TenderDetail
3. Ajouter secret OPENROUTER_API_KEY
4. Edge function analyze-tender
5. UI analyse IA dans TenderDetail
6. (Plus tard) Paiement Stripe + systeme coaching

