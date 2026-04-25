## Constat

`marches.maximilien.fr/?page=Entreprise.EntrepriseAdvancedSearch&AllCons` est bien une instance Atexo SDM (même moteur PRADO, même `PRADO_PAGESTATE`, même structure de pagination event-driven). Pareil pour :
- **maximilien** (Île-de-France)
- **aura** (Auvergne-Rhône-Alpes — `marchespublics.auvergnerhonealpes.eu`)
- **megalis** (Bretagne)
- **ternum** (Bourgogne-Franche-Comté)

Aujourd'hui ces 4 plateformes sont détectées avec leur **label régional** (par souci de reporting), mais dans `scrape-list/index.ts` l'aiguillage est strict :

```ts
platform === "atexo" ? executeAtexo(...) : execute(...)
```

→ Donc maximilien & co passent par le `playbookExecutor` générique (Firecrawl + sélecteurs CSS) au lieu du moteur PRADO musclé. C'est pour ça qu'on rate la pagination stateful sur ces sites.

## Solution : famille `atexo`

Plutôt que renommer `maximilien → atexo` (on perd le label régional utile en UI/reporting), on introduit une notion de **"famille d'engine"** :

### 1. Nouvelle constante `ATEXO_FAMILY`
Dans `supabase/functions/_shared/normalize.ts` :
```ts
export const ATEXO_FAMILY = new Set([
  "atexo",
  "maximilien",
  "aura",
  "megalis",
  "ternum",
]);
export function isAtexoFamily(platform: string): boolean {
  return ATEXO_FAMILY.has(platform);
}
```

### 2. Aiguillage dans `scrape-list/index.ts`
Remplacer :
```ts
platform === "atexo" ? executeAtexo(...) : execute(...)
```
par :
```ts
isAtexoFamily(platform) ? executeAtexo({...args, platform}) : execute(...)
```

→ Le label `maximilien` (etc.) reste en DB (`scrape_logs.metadata.platform`, `tenders.platform`), mais l'**engine** utilisé est PRADO. Best of both worlds.

### 3. Garde-fou dans `atexoExecutor.ts`
Ajouter en tête de `executeAtexo` un check léger : si l'URL ne contient pas `page=Entreprise.EntrepriseAdvancedSearch` ET pas de `/sdm/`, on log un warning et on tombe direct en Firecrawl fallback (au lieu de tenter PRADO sur une page non-SDM).

### 4. Pas touche au front
`src/lib/detectPlatform.ts` reste tel quel — il continue de renvoyer `"maximilien"` pour l'affichage UI. La famille n'est utilisée que côté edge function pour choisir le moteur.

## Fichiers modifiés

- `supabase/functions/_shared/normalize.ts` — ajout `ATEXO_FAMILY` + `isAtexoFamily()`
- `supabase/functions/scrape-list/index.ts` — aiguillage via `isAtexoFamily(platform)`
- `supabase/functions/_shared/atexoExecutor.ts` — garde-fou URL non-SDM (mineur)

## Résultat attendu

Pour `marches.maximilien.fr/?page=Entreprise.EntrepriseAdvancedSearch&AllCons` :
```
[atexo] engine=prado_event_chain, hidden_inputs=28, pagestate=XXk bytes
[atexo] page 1 (HTTP): 10 IDs, totalPages=N
[atexo:prado] sweep plan: totalPages=N, fullSweep=true, cap=25
... (rotation PRADO_PAGESTATE sur toutes les pages)
[atexo] DONE engine=prado_event_chain unique=~10*N coverage=1.0
```

Avec le label `platform: "maximilien"` conservé en DB.

## Bonus

Cette refacto rend trivial l'ajout de futures instances Atexo (ex: `marches-publics.bretagne-paysdelaloire.fr` ou autres skins régionaux) : il suffira d'ajouter une ligne dans `ATEXO_FAMILY`.
