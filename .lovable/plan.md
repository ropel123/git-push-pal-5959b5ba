## Problème

La table `tenders` pour les portails Atexo contient des données vides :
- `title = "Consultation Atexo 607164"` (placeholder)
- `buyer_name = null`, `deadline = null`, `publication_date = null`, `reference = ID interne`

Conséquence : scoring inutilisable, filtres région/CPV/deadline cassés, agent IA DCE sans contexte.

## Cause (vérifiée sur le HTML demat-ampa)

La page **liste** Atexo ne contient que les `col_actions` (lien + ID encodé). Les colonnes "Intitulé / Objet / Acheteur / Dates" sont injectées en AJAX au runtime, donc absentes du HTML brut → ni le sweep PRADO, ni Firecrawl `onlyMainContent: true` ne les voient.

En revanche, la page **détail** `/entreprise/consultation/{id}` contient en HTTP brut tous les champs avec des labels stables (cf. capture utilisateur) :

```
Date et heure limite de remise des plis : 30/04/2026 12:00
Référence :                                2026-M0660001-00
Intitulé :                                 MISSIONS DE FORMATION...
Objet :                                    Limoges Métropole, dans le cadre...
Organisme :                                LIMOGES MÉTROPOLE - COMMUNAUTÉ URBAINE
```

## Solution : enrichir chaque ID par fetch détail

### Nouveau fichier `supabase/functions/_shared/atexoDetailParser.ts`

- `fetchAtexoDetail(id, baseHost, cookies, signal)` :
  - GET `https://{host}/entreprise/consultation/{id}` avec le cookie jar de la session PRADO (sinon redirect vers login).
  - Timeout 8s par fiche.
  - Retourne `{ title, object, buyer_name, deadline, publication_date, reference, procedure_type, cpv_codes }`.

- Regex sur la table label/valeur Atexo :
  ```
  /Date.{0,40}limite.{0,40}remise.{0,40}plis\s*:[\s\S]{0,400}?(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/i
  /Référence\s*:[\s\S]{0,200}?<[^>]+>([^<]{3,80})</i
  /Intitulé\s*:[\s\S]{0,400}?<[^>]+>([\s\S]{3,500}?)</i
  /Objet\s*:[\s\S]{0,400}?<[^>]+>([\s\S]{10,3000}?)</i
  /Organisme\s*:[\s\S]{0,400}?<[^>]+>([^<]{3,200})</i
  ```
- Nettoyage : `decodeEntities`, `trim`, normalisation des espaces, conversion FR `30/04/2026 12:00` → ISO via `parseFrenchDate` existant.

### Modif `atexoExecutor.ts`

Après `runPradoEventChain`, avant `finalize` :

```ts
await enrichWithDetails(allIds, baseHost, pradoState.cookies, stats);
```

`enrichWithDetails` :
- Pool concurrent de **6 fetch parallèles** (rate limit doux).
- Budget global `MAX_DETAIL_TIME_MS = 60_000`.
- Itère sur les IDs sans `c.data` :
  - Succès → `c.data = { title, object, buyer_name, deadline, ... }`, `c.source = "detail_html"`.
  - Échec/timeout → on garde l'entry telle quelle (pas de régression vs aujourd'hui).
- Telemetry ajoutée à `_atexo_stats` : `details_fetched`, `details_failed`, `details_time_ms`, `parser_match_rate`.

Estimation : 340 IDs × 400ms / 6 parallèles ≈ 23s — confortablement dans les 120s totales.

### Suppression du Firecrawl LLM-extract sur la liste

Devenu inutile (la liste n'a pas les données) :
- L'appel `firecrawlScrapeStructured` ne sert plus que de **fallback HTML** quand le HTTP brut initial échoue (captcha/403). On le déplace dans une branche conditionnelle `if (!initialHtml)`.
- Économie : ~1 call Firecrawl par scrape Atexo × 30 portails × 4 runs/jour = ~120 calls/jour.

### Ajustement `finalize()`

- `reference: c.data?.reference || c.id` → vraie réf publique (`2026-M0660001-00`) au lieu de l'ID PRADO (`607164`).
- `title: c.data?.title || ` Consultation Atexo ${c.id}`` (le fallback reste pour ne pas casser quand le détail échoue).

## Fichiers touchés

| Fichier | Action |
|---|---|
| `supabase/functions/_shared/atexoDetailParser.ts` | **Nouveau** — fetch + parse fiche détail |
| `supabase/functions/_shared/atexoExecutor.ts` | Étape `enrichWithDetails` avant `finalize`, Firecrawl liste devient fallback |

`upsert-tenders/index.ts` n'a pas besoin de changer : il consomme déjà `title`, `buyer_name`, `deadline`, `publication_date`, `procedure_type`, `reference`, `description`.

## Résultat attendu après re-scrape

| Champ | Avant | Après |
|---|---|---|
| `title` | "Consultation Atexo 660001" | "Missions de formation professionnelle…" |
| `reference` | "660001" | "2026-M0660001-00" |
| `buyer_name` | `null` | "Limoges Métropole - Communauté Urbaine" |
| `deadline` | `null` | `2026-04-30T12:00:00Z` |
| `description` | `null` | "Limoges Métropole, dans le cadre…" |

→ Scoring redevient pertinent, filtres région/deadline opérationnels, agent IA DCE a le contexte.

## Robustesse multi-skin

Les labels FR (`Date et heure limite`, `Référence`, `Intitulé`, `Objet`, `Organisme`) sont identiques sur Atexo / Maximilien / Aura / Megalis / Ternum (même PRADO sous le capot). On loggue `parser_match_rate` par run pour détecter rapidement si un skin diverge — auquel cas on ajoutera des fallbacks regex sans casser les autres.
