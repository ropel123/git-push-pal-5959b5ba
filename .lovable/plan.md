# Audit complet de la classification + plan de refonte

## 1. Pourquoi des Atexo / MPI évidents tombent en `custom` — 4 bugs cumulés

### Bug #1 : Double seuil de confiance (le bug principal)

J'avais supprimé le seuil 0.65 dans `aiClassifierAnthropic.ts`, mais il y a un **deuxième seuil** dans `normalize.ts` ligne 175-287 :

```ts
const AI_CONFIDENCE_THRESHOLD = 0.6;
...
if (ai.confidence < AI_CONFIDENCE_THRESHOLD || finalPlatform === "custom") {
  // → rétrograde en custom
}
```

**Preuve dans la base** :
| URL | Verdict Anthropic | confiance | Stocké en DB |
|---|---|---|---|
| `webmarche.solaere.recia.fr` | atexo | **0.72** ✅ | custom ❌ |
| `marchespublics-opac-rhone.omnikles.com/xmarches/...` | (http-400) | 0 | custom |
| `omnikles` (low-conf 0.55) | omnikles | 0.55 | custom |

Le RECIA est **clairement** un Atexo/SDM (pattern `?page=Entreprise.EntrepriseAdvancedSearch&AllCons` 100% LocalTrust). Anthropic l'a vu à 0.72 mais on l'a jeté.

### Bug #2 : Anthropic ignore les Omnikles évidents

`marchespublics-opac-rhone.omnikles.com/xmarches/okmarche/...` : le hostname contient littéralement `omnikles.com` ET `xmarches` ET un path Omnikles canonique. Notre detector hostname (`detectPlatformFromUrl`) **n'a pas de règle Omnikles** → on tombe en IA → l'IA renvoie http-400 → custom.

Hostnames manquants dans `normalize.ts` :
- `*.omnikles.com` → `omnikles`
- `aji-france.com` → `aji`  
- `bravosolution.com` / `jaggaer` → on devrait avoir une plateforme mais elle n'est pas dans l'enum
- `*.solaere.recia.fr` (RECIA SDM) → `atexo`
- `marchespublics.*.com` avec `?page=Entreprise.EntrepriseAdvancedSearch` → `atexo` (signature SDM/LocalTrust universelle)

### Bug #3 : Anthropic web_fetch échoue silencieusement → http-400

Plusieurs URLs renvoient `http-400`. Pas un problème de crédit (les autres URLs marchent). Probablement :
- Sites qui bloquent le user-agent d'Anthropic web_fetch
- Sites en HTTP (pas HTTPS) que web_fetch refuse
- Sites .gov.fr ou .nc avec WAF

Quand `web_fetch` échoue, Anthropic devrait quand même classifier sur **l'URL seule** (hostname + path) — mais notre prompt actuel l'oblige à utiliser web_fetch.

### Bug #4 : L'agent ne cite pas la signature DOM

Quand Anthropic répond avec confidence 0.45-0.75, son `reasoning` dit "vraisemblablement", "structure cohérente", "probablement" — preuve qu'il n'a **pas vraiment inspecté le DOM**, il devine sur l'URL. Les vrais Atexo ont des marqueurs incontournables dans le HTML :
- `class="atexo-*"`, `id="atexo*"`
- script `<script src=".../app_atexo.js">`
- meta `generator` ou footer "atexo"
- formulaire avec `name="form_consultations"` (SDM)

L'agent doit être obligé de **citer textuellement** ces éléments, sinon sa réponse est un guess.

## 2. Stratégie de refonte — pipeline déterministe + IA en dernier recours

Approche actuelle : URL → IA fait tout → résultat
Nouvelle approche : **3 couches en cascade**, on n'appelle l'IA QUE si tout le reste échoue.

### Couche 1 : Hostname extensif (gratuit, instantané)

Élargir `detectPlatformFromUrl` avec :
- Tous les éditeurs de SaaS connus (`*.omnikles.com`, `*.bravosolution.com`, `*.jaggaer.com`, `*.synapse-entreprises.com`, etc.)
- Patterns d'URL universels Atexo/SDM/LocalTrust : `?page=Entreprise.EntrepriseAdvancedSearch`, `?page=entreprise.EntrepriseAdvancedSearch`, `/sdm/`, `/app_atexo/`, `/sdm/ent2/`
- Patterns MPI/ColdFusion : `*.cfm?fuseaction=`, `?fuseaction=consultations`
- Patterns Omnikles : `/okmarche/`, `/xmarches/okmarche/`
- Patterns Domino : `?OpenForm`, `?ReadForm`, `*.nsf/`

Estimation : ça fait passer ~30 URLs custom en classifiées, gratuit, 0ms.

### Couche 2 : Fetch HTML local + signatures DOM (notre code, pas d'IA)

Plutôt que d'appeler l'IA, on fait nous-mêmes une requête GET et on cherche des signatures dans le HTML brut :

```
"atexo-" → atexo (confidence 0.95)
"app_atexo" → atexo (0.99)
"klk-" classes → klekoon
"localtrust" → atexo
"<meta name=\"generator\" content=\"...\">" → match contre une table
script src contenant "/atexo/", "/sdm/", "/mpi/", etc.
```

Avantage : déterministe, gratuit, traçable, on cite la ligne exacte du HTML qui a déclenché le match.

C'est ce que fait Wappalyzer pour les CMS — on en fait une mini-version pour les plateformes MP.

### Couche 3 : IA en fallback uniquement

L'IA n'est appelée QUE si couches 1+2 = custom. Et on lui demande de :
1. Faire `web_fetch`
2. **Citer textuellement** au moins 1 ligne du HTML qui justifie sa réponse
3. Si elle ne peut pas citer, renvoyer custom direct (pas de devine)
4. Pas de seuil — on garde son verdict tel quel

Et **on supprime le seuil 0.6 dans `normalize.ts`** (le double-filtre actuel).

### Couche 4 (bonus) : Apprentissage continu via `platform_fingerprints`

À chaque classification réussie en couche 2 ou 3, on stocke dans `platform_fingerprints` :
- hostname
- platform détectée
- evidence textuelle (le bout de HTML qui a déclenché le match)
- confidence

Au prochain reclassify, la couche cache (déjà existante) prend le relais → 0 coût.

## 3. Pourquoi c'est critique pour l'aval (tu as raison)

Une fois la plateforme correctement identifiée, on peut :
- **Sourcing** : router chaque URL vers le bon parser de liste (atexo = POST formulaire avec viewstate, MPI = GET ColdFusion, Omnikles = REST JSON, Domino = OpenForm)
- **DCE** : router vers le bon agent Browserbase / Firecrawl avec le bon playbook (atexo = login + accept CGU + click "Télécharger DCE", MPI = solveur captcha + form, Domino = nav `?ReadForm` + nsf URL)
- **Mémoire collective** : nourrir `agent_playbooks` automatiquement avec les patterns de chaque plateforme

Si on classifie 80% en custom, on n'a aucun de ces leviers — on retombe sur du Firecrawl générique qui rate la plupart des AO.

## 4. Plan d'implémentation (ordre exécution)

1. **Supprimer le seuil 0.6** dans `normalize.ts` ligne 276 (gain immédiat : RECIA et tous les `low-conf > 0` repassent en plateforme correcte)
2. **Étendre `detectPlatformFromUrl`** avec les patterns hostname + path manquants (omnikles, aji, recia, SDM universel, ColdFusion, Domino)
3. **Créer `detectPlatformFromHtml`** : un nouveau module qui scanne le HTML brut pour les signatures DOM, sans IA. Appelé entre couche 1 (hostname) et couche 3 (IA).
4. **Renforcer le prompt Anthropic** pour exiger une citation textuelle du HTML, et autoriser à classifier sur l'URL seule si web_fetch échoue
5. **Re-classifier les 58 URLs custom** après ces 4 changements et mesurer le résidu

Estimation : on doit passer de **58 custom → ~10-15 custom** (les vrais sites maison type aéroport Nice, port Martinique, ville-courbevoie qui n'ont pas de plateforme SaaS derrière).

## Hors scope

- Pas de changement DB (on utilise les tables existantes : sourcing_urls, platform_fingerprints, agent_playbooks)
- Pas de touche à OpenRouter/Opus (la couche 3 reste comme aujourd'hui, juste mieux promptée)
- Pas de refonte UI (les filtres ajoutés tout à l'heure + le toast suffisent pour debug)
