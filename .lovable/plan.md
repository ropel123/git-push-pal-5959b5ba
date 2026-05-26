# Playbook `achatpublic` (≠ Atexo)

## Constat

`www.achatpublic.com` est un **éditeur indépendant**, pas Atexo. Le flow est beaucoup plus court :

1. Page consultation `…/ficheCsl.action?PCSLID=…` → onglet **Pièces de marché** (`&ongletActif=2`, déjà dans l'URL)
2. Section "Dossier de consultation des entreprises - DCE" → liste de ZIP versionnés (`dce-v1.zip`, `dce-v2.zip`, …) → **prendre le plus récent** (le dernier de la liste = version la plus haute = date la plus récente)
3. Clic `Télécharger` → modale **Connexion / Inscription** "Souhaitez-vous vous identifier ?" → cliquer **Non** (téléchargement anonyme direct)
4. Le ZIP arrive (pas de CGU, pas de formulaire identité, pas de captcha)

Aujourd'hui en base on a un seul playbook `atexo_achatpublic` (15 étapes Atexo) qui sert à la fois pour `achatpublic.com` ET pour les sous-domaines Atexo SPL (Meuse). À séparer.

## Plan

### 1. Migration SQL

**a)** Renommer le playbook actuel `atexo_achatpublic` → `atexo_spl` (pour qu'il reste le playbook Atexo SPL générique, utilisé pour Meuse et autres sous-domaines), et changer son `url_pattern` pour qu'il ne matche **plus** `achatpublic.com`.

**b)** Insérer un nouveau playbook `achatpublic` :
- `platform = 'achatpublic'`
- `display_name = 'AchatPublic.com'`
- `url_pattern = 'achatpublic\.com'`
- `requires_auth = false`, `requires_captcha = false`
- Steps (~7) :
  1. `goto` URL DCE
  2. `ensure_tab` onglet "Pièces de marché" (si pas déjà actif via `ongletActif=2`)
  3. `wait_selector` section "Dossier de consultation des entreprises"
  4. `pick_latest_dce` — sélectionner le dernier `dce-vN.zip` (plus grand N) ou trier par date
  5. `click` bouton "Télécharger" de cette ligne
  6. `wait_modal` "Connexion / Inscription" → `click` bouton **Non**
  7. `wait_download` (ZIP)

### 2. Routing — `fetch-dce-agent/index.ts`

- `SOURCE_PLATFORM_MAP` : `scrape:achatpublic` → `achatpublic` (au lieu de `atexo_achatpublic`)
- `SOURCE_PLATFORM_MAP` : `scrape:atexo` → `atexo_spl` (suit le renommage)
- `HOSTNAME_PLATFORM_MAP` :
  - `/^(www\.)?achatpublic\.com$/i` → `achatpublic` (avant `/atexo/i` dans la cascade)
  - `/profilacheteur\./i` → `atexo_spl` (Meuse etc.)

### 3. Executor

Le `playbookExecutor` doit gérer 2 nouvelles primitives propres à achatpublic :
- `pick_latest_dce` — parser le DOM, extraire toutes les lignes `dce-v(\d+)\.zip`, garder le `data-row` du N max
- `wait_modal` + `click "Non"` — déjà couvrable avec les primitives `wait_selector` + `click` existantes si la modale a un sélecteur stable

À vérifier en lisant `supabase/functions/_shared/playbookExecutor.ts` avant migration : si `pick_latest_dce` n'existe pas, soit on l'ajoute, soit on utilise une combinaison `query_all` + `click_index:last`.

### 4. Test

Re-tester sur le tender courant (`9e52e006-…`, source `scrape:achatpublic`) → `agent_runs.platform` doit valoir `achatpublic`, et le ZIP `dce-vN.zip` le plus récent doit atterrir dans `dce-documents/`.

## Aucun secret à ajouter

Tout passe par les secrets Browserbase / Anthropic déjà configurés.
