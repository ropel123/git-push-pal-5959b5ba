# Plan : agent IA `fetch-dce-mpi` (auth Hackify + captcha 1ère fois)

## Flow MPI confirmé

```
1er retrait :
  GET  dematEnt.login&type=DCE&IDM=...
  → page captcha image
  → POST captcha + email/password Hackify
  → cookie session (CFID/CFTOKEN/JSESSIONID) valide plusieurs h/j

Retraits suivants (même cookie) :
  GET  dematEnt.login&type=DCE&IDM=...
  → direct page DCE avec lots
  → cocher tous lots + télécharger ZIP
```

Clé du design : **persister le cookie de session MPI** pour amortir le captcha sur N retraits.

## Architecture

### Nouvelle table `platform_sessions`
Stocke les cookies de session par plateforme pour les réutiliser.

| Champ | Type | Notes |
|---|---|---|
| platform | text | 'mpi', 'atexo'... |
| cookies | jsonb | { CFID, CFTOKEN, JSESSIONID, ... } |
| expires_at | timestamptz | now() + 12h par défaut |
| last_used_at | timestamptz | |
| login_count | int | métrique |

RLS : service_role only (jamais exposé client).

### Edge function `fetch-dce-mpi`

`supabase/functions/fetch-dce-mpi/index.ts` + `_shared/mpiClient.ts`.

**Logique :**

```text
1. Lire platform_sessions where platform='mpi' AND expires_at > now()
2. Si cookie valide :
     GET page DCE → si HTML contient form login → cookie expiré, goto 3
     Sinon → parser lots, télécharger ZIP, return ✓
3. Sinon (1ère fois ou expiré) :
     GET landing → extraire image captcha
     2Captcha resolve (TWOCAPTCHA_API_KEY déjà présent)
     POST captcha + MPI_LOGIN/MPI_PASSWORD
     Capturer Set-Cookie → upsert platform_sessions (expires_at = now()+12h)
     Retry étape 2
4. Upload ZIP → bucket dce-documents/{tender_id}/dce.zip
5. Insert dce_downloads + dce_uploads (lots)
```

**Throttling** : max 1 login complet (avec captcha) / 30s. Les retraits avec cookie valide ne sont pas throttlés.

### Routing depuis `fetch-dce-agent`
Détection serveur : si `platform === 'mpi'` et secrets MPI présents → `supabase.functions.invoke('fetch-dce-mpi', { tender_id })` au lieu de Browserbase. Pas de changement UI nécessaire.

## Secrets requis (bloquant)
- `MPI_LOGIN` = `f.farrero@hackify.fr`
- `MPI_PASSWORD`
- `TWOCAPTCHA_API_KEY` (déjà présent ✓)

## Étapes d'implémentation
1. Ajouter secrets MPI_LOGIN / MPI_PASSWORD via `add_secret`
2. Migration : table `platform_sessions` + RLS service_role
3. Créer `_shared/mpiClient.ts` (cookie jar, login, captcha, parse lots, download)
4. Créer `fetch-dce-mpi/index.ts` (orchestration + insert dce_downloads/uploads)
5. Patch `fetch-dce-agent/index.ts` : fast-path si platform='mpi'
6. Test sur AO actuel (IDM 1820420, 13 lots) : 1er appel doit résoudre captcha, 2ème doit aller direct

## Détails techniques
- Cookie jar simple : `Map<string,string>` reconstruit depuis `Set-Cookie`, sérialisé en JSON avant insert
- Image captcha : récupérer via fetch en gardant le cookie de session preview, base64 → 2Captcha `method=base64`
- Form submit en `application/x-www-form-urlencoded`, ColdFusion `fuseaction=...`
- Détection cookie expiré : présence de `<input type="password"` ou `fuseaction=dematEnt.login`
- ZIP traité comme blob unique (bucket dce-documents) + entrée dce_uploads par lot parsé depuis la page

Confirme-tu pour qu'on ajoute les secrets MPI ?