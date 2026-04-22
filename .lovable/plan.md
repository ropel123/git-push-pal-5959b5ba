

# Détection de plateforme par signaux HTML/HTTP (au-delà du hostname)

## Pourquoi

Le hostname seul ne suffit pas : `marchespublics.auvergnerhonealpes.eu` ne dit pas qu'il tourne sur Atexo/LocalTrust. Mais chaque éditeur (Atexo, MPI, ColdFusion, achatpublic, Klekoon, SafeTender…) laisse des **signatures techniques uniques** dans les pages qu'il sert. On peut les lire en HTTP/HTML pour fiabiliser à 99 %.

## Signaux disponibles (tous gratuits, sans clé API)

### 1. Signaux HTTP (HEAD/GET — ultra rapide)

```text
Header                     Indice
─────────────────────────────────────────────────
Server: Apache + mod_jk    → ColdFusion/Atexo legacy
X-Powered-By: ASP.NET      → MPI / e-marchespublics
Set-Cookie: ATEXO_SESSID   → Atexo (toutes versions)
Set-Cookie: CFID/CFTOKEN   → ColdFusion (MPI ancien, achatpublic)
Set-Cookie: JSESSIONID     → Java/Atexo SDM (LocalTrust)
Set-Cookie: PLACE_SESSION  → PLACE (DGFiP)
```

### 2. Signaux HTML (1 fetch + regex)

```text
Pattern dans le HTML                              Plateforme
───────────────────────────────────────────────────────────────
<meta name="generator" content="Atexo">           atexo
/atexo-mpe/, /app_atexo/, atexoStatic             atexo
class="atxLogo" / atx-                            atexo
fuseaction=entreprise.AllCons                     mpi (ColdFusion)
?refConsult= / cfm? / index.cfm                   mpi
/sdm/ent2/gen/ + .action                          atexo SDM (LocalTrust)
window.PLACE_CONFIG / place_logo                  place
<script src="*safetender*">                       safetender
data-app="achatpublic"                            achatpublic
class*="klk-" / klekoon-                          klekoon
favicon = /favicon-mpe.ico                        atexo MPE
```

### 3. Signaux DNS (CNAME/IP)

```text
CNAME se termine par      Plateforme
────────────────────────────────────────
*.atexo.com               atexo (hébergement mutualisé)
*.localtrust.fr           atexo SDM
*.achatpublic.com         achatpublic
*.cloudfront.net + …      à analyser au cas par cas
```

(Optionnel — coûteux et pas toujours déterministe, on peut l'ignorer en v1.)

### 4. Signaux structurels d'URL (déjà partiellement implémentés)

```text
/sdm/ent2/gen/*.action                  → atexo (LocalTrust SDM)
/index.cfm?fuseaction=…                 → mpi (ColdFusion)
/index.php?page=entreprise.…            → atexo MPE
/app/Plateforme/Public/                 → place
```

## Plan d'action

### Étape 1 — Sonde HTTP/HTML "fingerprint"

Nouvelle fonction `detectPlatformByFingerprint(url)` côté edge function (Deno, donc fetch natif) :

1. `fetch(url, { method: "GET", redirect: "follow" })` (timeout 8s).
2. Inspecte dans l'ordre :
   - **headers** (`server`, `x-powered-by`, `set-cookie`),
   - **HTML brut** (regex sur les patterns ci-dessus),
   - **balises** `<meta generator>`, `<link rel="icon">`, `<script src>`.
3. Retourne `{ platform, confidence: 0..1, evidence: ["cookie:ATEXO_SESSID", "html:atexoStatic"] }`.
4. Cache le résultat 24h dans une table `platform_fingerprints (host, platform, evidence, detected_at)` pour ne pas re-sonder à chaque scrape.

### Étape 2 — Pipeline de classification à 3 niveaux

```text
detectPlatform(url) =
  1. fingerprint cache (host → platform, < 24h)        ← instant
  2. detectPlatformFromUrl(url) (signatures hostname)  ← actuel
  3. detectPlatformByFingerprint(url) (HTTP probe)     ← nouveau
  4. fallback "custom" + log warning
```

Le niveau 3 ne se déclenche que si les niveaux 1+2 retournent `custom` ou un score faible. Donc 0 surcoût pour les URLs déjà connues.

### Étape 3 — Reclassement des "custom" actuels

Une fonction admin `reclassify-sourcing-urls` qui :
- prend toutes les `sourcing_urls` avec `platform = 'custom'` (ou `safetender` suspect),
- lance le fingerprint sur chacune,
- met à jour `platform` + écrit l'evidence dans `metadata.platform_evidence`.

Bouton dans `/sourcing` : "Re-détecter les plateformes" (admin only).

### Étape 4 — Affichage dans l'UI

Sur `/sourcing`, à côté du badge plateforme :
- icône ℹ️ qui ouvre un tooltip avec l'evidence (ex. `cookie:ATEXO_SESSID + html:/atexo-mpe/`).
- bouton "🔄 Re-détecter" sur chaque ligne pour forcer un refresh du fingerprint.

## Fichiers concernés

```text
supabase/functions/_shared/fingerprint.ts        ← nouveau, fetch + regex
supabase/functions/_shared/normalize.ts          ← appelle fingerprint en fallback
supabase/functions/reclassify-sourcing-urls/     ← nouveau, batch admin
supabase/migrations/<ts>_platform_fingerprints.sql  ← cache table
src/pages/Sourcing.tsx                           ← bouton re-détecter + tooltip evidence
```

## Table cache

```sql
create table platform_fingerprints (
  id uuid primary key default gen_random_uuid(),
  host text not null unique,
  platform text not null,
  confidence numeric not null,
  evidence jsonb not null default '[]',
  detected_at timestamptz not null default now()
);
```

RLS : admin only en write, authenticated en read.

## Effet attendu

- Pour `marchespublics.auvergnerhonealpes.eu`, la sonde verra `Set-Cookie: ATEXO_SESSID` ou `/atexo-mpe/` dans le HTML → reclassée en **atexo** avec evidence vérifiable, plus jamais en "safetender".
- Toute nouvelle URL inconnue est classée automatiquement dès le premier scrape.
- Les évidences sont auditables dans l'UI (tu vois pourquoi on a dit "atexo").

