# Plan v3.4.1 — Atexo / PRADO : event-chain POST replay

## Diagnostic confirmé sur HTML réel d'Alsace

Atexo tourne sur **PRADO** (PHP, équivalent ASP.NET WebForms). Preuves trouvées :

```text
form id="ctl0_ctl1" method="post" action="/?page=Entreprise.EntrepriseAdvancedSearch&AllCons"
hidden PRADO_PAGESTATE   = "eJzt/UuT40aWLor2uH8FbtY+yqprYorgm6lWb0Mw…"  (énorme)
hidden _csrf_token       = "..."
input  ctl0$CONTENU_PAGE$resultSearch$numPageBottom   value="1"
js     new Prado.WebUI.TLinkButton({
         EventTarget:"ctl0$CONTENU_PAGE$resultSearch$PagerBottom$ctl2"  // = next
       })
```

Le clic "page suivante" déclenche un JS Prado qui POST avec :

```text
PRADO_POSTBACK_TARGET     = ctl0$CONTENU_PAGE$resultSearch$PagerBottom$ctl2
PRADO_POSTBACK_PARAMETER  = ""
PRADO_PAGESTATE           = <state courant>
_csrf_token               = <token courant>
+ TOUS les autres champs du form
```

Cookies session (`PHPSESSID`) maintenus côté navigateur. Firecrawl crée un nouveau navigateur à chaque call → état perdu → page 1 renvoyée systématiquement. CQFD.

## Ce qui change vs v3.4 (intégration du feedback)

| Point | v3.4 | v3.4.1 (cible) |
|---|---|---|
| State chaining | implicite | **strict, obligatoire** : `state(N) = response(N-1)` |
| Saut de page (`gotoPage`) | exposé en API | **supprimé** comme primitive — uniquement event-chain |
| Champs réinjectés | `pagestate + csrf` | **tous les hidden inputs du form** + `pagestate` + `csrf` |
| Concurrence pages | non précisé | **séquentiel strict**, pas de Promise.all |
| Cookies | mentionnés | **jar persistant** sur toute la chaîne |
| Détection moteur | hardcodée Atexo | colonne `pagination_engine` détectée à partir de `PRADO_PAGESTATE` |

## Architecture finale

### Nouveau module `supabase/functions/_shared/pradoClient.ts`

API minimale, pure (pas de Supabase) :

```text
type FormState = {
  url:           string                  // action URL absolue
  cookies:       string                  // header Cookie reconstruit
  hiddenInputs:  Map<string,string>      // TOUS les hidden inputs du <form>
  pageState:     string                  // PRADO_PAGESTATE (extrait de hiddenInputs aussi)
  csrfToken:    string | null
}

async fetchInitialPage(url): Promise<{ html, state: FormState }>

async postEvent(state: FormState, eventTarget: string, eventParameter = ""):
   Promise<{ html, state: FormState }>   // newState = re-extrait du HTML retour

extractFormState(html, baseUrl): FormState
extractIdsFromHtml(html): string[]
extractTotalPages(html): number
extractNextPagerEventTarget(html): string | null   // "...PagerBottom$ctl2"
```

Règles :

1. **State chaining strict** : `postEvent` consomme un `FormState`, retourne le **nouveau** state à utiliser au tour suivant. Il est interdit de réutiliser un ancien state.
2. **Cookies jar** : on conserve `Set-Cookie` de chaque réponse, on les rejoue dans la requête suivante (PHPSESSID rotation incluse).
3. **Hidden inputs intégraux** : on ne sélectionne pas — on réinjecte tout le form, sauf les `<input type="submit">` non concernés. Évite les "champs JS-générés" oubliés.
4. **Headers réalistes** : `User-Agent` Chrome récent, `Referer = url`, `Origin = host`, `X-Requested-With: XMLHttpRequest` (PRADO callback hint).
5. **Pas de `gotoPage` direct** dans la couche client. Si quelqu'un veut sauter, il devra ajouter une fonction séparée plus tard, mais l'executor n'utilise QUE next-event.

### Détection moteur : colonne `pagination_engine`

Pas besoin de migration DB obligatoire — on stocke dans `agent_playbooks.config` (jsonb existant) :

```json
{ "pagination_engine": "prado_event_chain" }
```

Détection au scrape n°1 dans `atexoExecutor` :
- HTML contient `name="PRADO_PAGESTATE"` ET un pager `EventTarget:"...PagerBottom$ctl2"` → `prado_event_chain`
- Sinon → fallback sur l'ancien Firecrawl actions (cas non-PRADO)

Persistance : on met à jour le playbook via `agent_playbooks` à la fin du run (best-effort).

### Refonte `atexoExecutor.ts`

```text
1. fetchInitialPage(url)
   → IDs page 1, totalPages, state₀, cookies₀
   → engine = detectEngine(html)

2. SI engine === "prado_event_chain" :
     state = state₀
     for i in 1..min(totalPages-1, MAX_PAGES_PER_RUN):
        nextTarget = extractNextPagerEventTarget(lastHtml)
        si null → break (plus de bouton next)
        { html, state } = await postEvent(state, nextTarget)   // chaining strict
        ids = extractIdsFromHtml(html)
        si fingerprint(ids, firstRowText) === fingerprintPrev → log + break
        merge dans allIds
   SINON :
     fallback v3.3 (Firecrawl actions)

3. finalize
```

### Garde-fous

```text
MAX_PAGES_PER_RUN = 8       (HTTP simple, coût ~0)
TIMEOUT_PER_POST  = 15s
MAX_TOTAL_TIME    = 90s
```

- `consecutiveNoNew >= 1` → stop (pas besoin de 2 sur PRADO car déterministe).
- Si `PRADO_PAGESTATE` absent dans une réponse → log `pagestate_lost`, stop.
- Sequential await strict, pas de `Promise.all`.
- Une seule extraction IA Firecrawl en option sur la page 1 (gardée pour enrichir `title/buyer_name/deadline`), tout le reste = HTTP brut.

### Stats enrichies dans `_atexo_stats`

```text
engine: "prado_event_chain" | "firecrawl_fallback"
pagestate_rotations: number          // doit == pages_scraped - 1
csrf_rotations: number
cookies_rotations: number
http_status_per_page: number[]
event_targets_used: string[]         // pour debug
hidden_inputs_count: number          // sanity check
```

## Validation

URL test : `https://plateforme.alsacemarchespublics.eu/?page=Entreprise.EntrepriseAdvancedSearch&AllCons` (18 pages × 10).

Critères :

```text
engine = "prado_event_chain"
pages_scraped >= 5
unique_consultations >= 50
pagestate_rotations >= 4
http_status_per_page = [200,200,200,200,200,...]
calls_firecrawl <= 1   (page 1 enrichissement seulement)
dom_stuck_detected = false
```

Régression : relancer sur les 4 autres URLs Atexo déjà actives (paysdelaloire, demat-ampa, adm76, solaere.recia, marchespublics.nc).

## Hors scope (étapes suivantes possibles)

- Augmenter `MAX_PAGES_PER_RUN` au-delà de 8 pour les très gros portails (à valider après V3.4.1).
- Détection automatique multi-frameworks (PRADO / WebForms / SSR React / infinite scroll) → "Universal Stateful Pagination Engine" : noté pour plus tard.
- `gotoPage` direct comme optimisation : seulement si on observe que PRADO l'accepte sans casser l'event chain.
- Browserbase fallback global : pas pour cette itération.
