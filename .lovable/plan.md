# Pourquoi le DCE Meuse passe en "generic"

L'URL `profilacheteur.meuse.fr/...` est une instance Atexo SPL mais sur un domaine custom. La cascade actuelle (`detectPlatform`) ne regarde que `dce_url` :

1. Regex playbooks → aucun match (`achatpublic.com` / `local-trust.com` ne matchent pas `meuse.fr`)
2. `HOSTNAME_PLATFORM_MAP` → aucun match
3. Fallback → `generic` ❌

Pourtant le tender a `source = "scrape:atexo"` en BDD : on a déjà l'info, on ne s'en sert pas.

# Fix

## 1. `supabase/functions/fetch-dce-agent/index.ts`

**a)** Étendre `detectPlatform()` pour accepter un `tenderSource` optionnel. Nouvelle cascade :
1. Regex `url_pattern` des playbooks (inchangé)
2. `HOSTNAME_PLATFORM_MAP` (inchangé)
3. **NOUVEAU** : si `tenderSource` commence par `scrape:`, mapper le suffixe vers un playbook :
   - `scrape:atexo` → `atexo_achatpublic` (playbook SPL générique)
   - `scrape:maximilien` → `maximilien`
   - `scrape:place` → `place`
   - etc.
4. Fallback `generic`

**b)** Dans le handler principal, charger `source` du tender en même temps que `dce_url`, et le passer à `detectPlatform(supabase, dce_url, tenderSource)`.

**c)** Ajouter `profilacheteur.` au `HOSTNAME_PLATFORM_MAP` (ceinture+bretelles) pointant vers `atexo_achatpublic`.

## 2. Logs

Logger explicitement la voie de détection retenue (`router.detect_platform` → `regex` | `hostname` | `source` | `fallback`) pour qu'on voie au prochain run que c'est bien `source:atexo → atexo_achatpublic`.

# Aucune migration nécessaire

Le playbook `atexo_achatpublic` existe déjà avec le flow Maximilien-style (15 étapes anonyme + CGU + wait_download). On change juste le routeur.

# Test

Relancer le DCE Meuse → `agent_runs.platform` doit passer à `atexo_achatpublic`, et le flow anonyme doit s'exécuter.
