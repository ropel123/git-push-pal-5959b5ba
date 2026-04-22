

# Fix lien "Voir l'avis original" pour MPI / marchespublics.grandest.fr

## Le problème

Sur l'AO `2026A0210` (et 33 autres), le lien "Voir l'avis original" renvoie sur la page de résultats générique (`?fuseaction=pub.affResultats`) au lieu de la fiche de la consultation.

## Cause (constatée en base)

Il existe **deux entrées en doublon** pour la même AO :

| id | reference | dce_url |
|----|-----------|---------|
| `ecf3612b…` (la bonne) | `2026A0210` | `…?fuseaction=pub.affPublication&refPub=MPI-pub-20260801257&serveur=MPI&IDS=6067` ✅ |
| `4c6623a3…` (celle affichée) | `réf. 2026A0210` | `…?fuseaction=pub.affResultats` ❌ |

Deux problèmes :

1. **Référence polluée** : Firecrawl renvoie parfois `"réf. 2026A0210"` au lieu de `"2026A0210"`. Le préfixe `réf.` casse l'unicité `(source, reference)` → la même AO est insérée deux fois.
2. **dce_url générique** : pour la 2ᵉ extraction, Firecrawl n'a pas trouvé le lien fiche et a mis le lien de la page de résultats. Notre garde same-host dans `upsert-tenders` laisse passer (même hostname) → on stocke un lien inutile.

32 lignes ont une `reference` qui commence par `réf.`/`ref.`/`référence` et 34 lignes ont un `source_url` qui pointe vers une page générique (`affResultats`, `EntrepriseAdvancedSearch`, `AllCons`).

## Correctifs

### 1. Nettoyer la référence à l'ingestion (`supabase/functions/upsert-tenders/index.ts`)

Dans `makeReference`, retirer les préfixes parasites :

```ts
function cleanReference(s: string): string {
  return s
    .replace(/^\s*(réf\.?|ref\.?|référence|reference|n°|numéro|num\.?)\s*[:°-]?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}
```

→ `"réf. 2026A0210"` devient `"2026A0210"`, plus de doublons.

### 2. Rejeter les `dce_url` qui pointent vers une page générique (même fichier)

Liste de patterns "page de listing/résultats" à rejeter :

```ts
const GENERIC_PATHS = [
  /fuseaction=pub\.affResultats(?!.*[?&]ref(Pub|Cons|Consult))/i, // affResultats sans refPub/refConsult
  /EntrepriseAdvancedSearch/i,
  /AllCons\b/i,
  /page=recherche/i,
];
```

Si `raw_item_link` matche un de ces patterns → on l'ignore (`item_link = null`, raison loguée), `dce_url` retombe sur l'URL de listing (comportement actuel). Mieux : **on ne propose pas de lien "Voir l'avis original" du tout** (cf. point 4).

### 3. Renforcer le prompt Firecrawl (`supabase/functions/scrape-list/index.ts`)

Ajouter au prompt :

> "La référence est un identifiant brut (ex: `2026A0210`, `26CD310048`). N'inclus **jamais** les préfixes `réf.`, `ref.`, `n°`, `référence`, etc. Renvoie uniquement la valeur."
>
> "Pour `dce_url`, le lien doit contenir un identifiant unique de consultation (ex: `refPub=…`, `refConsult=…`, `id=123`, `/consultation/123`). Si le seul lien disponible pointe vers une page de résultats générique (`affResultats` sans paramètre, `AllCons`, `EntrepriseAdvancedSearch`), laisse `dce_url` **vide**."

### 4. Front (`src/pages/TenderDetail.tsx`)

Ne plus afficher "Voir l'avis original" si l'URL est manifestement générique. Petit helper :

```ts
const isGenericLink = (u?: string | null) =>
  !u || /(affResultats(?!.*ref(Pub|Cons))|EntrepriseAdvancedSearch|AllCons|page=recherche)/i.test(u);

const officialUrl = !isGenericLink(tender.dce_url) ? tender.dce_url
  : !isGenericLink(tender.source_url) ? tender.source_url
  : null;
```

→ on ne masque le bouton que si vraiment aucune URL utile n'existe.

### 5. Migration de nettoyage des données

Deux opérations SQL :

a. **Dédupliquer / consolider les références** :
```sql
UPDATE public.tenders
SET reference = regexp_replace(reference, '^\s*(réf\.?|ref\.?|référence|reference|n°|numéro|num\.?)\s*[:°-]?\s*', '', 'i')
WHERE reference ~* '^\s*(réf|ref|référence|reference|n°|numéro|num)';
```

b. **Supprimer les doublons** créés par cette pollution, en gardant la ligne avec le meilleur `dce_url` (celui qui contient `refPub`/`refConsult`/`/consultation/`) :
```sql
WITH ranked AS (
  SELECT id, source, reference,
    ROW_NUMBER() OVER (
      PARTITION BY source, reference
      ORDER BY (CASE WHEN dce_url ~* '(refPub=|refConsult=|/consultation/|IDS=\d|IDs=\d)' THEN 0 ELSE 1 END),
               created_at DESC
    ) AS rn
  FROM public.tenders
)
DELETE FROM public.tenders t USING ranked r
WHERE t.id = r.id AND r.rn > 1;
```

c. **Vider les `dce_url`/`source_url` génériques restants** pour les lignes uniques :
```sql
UPDATE public.tenders
SET dce_url = NULL
WHERE dce_url ~* '(fuseaction=pub\.affResultats(?!.*ref(Pub|Cons|Consult))|EntrepriseAdvancedSearch|AllCons|page=recherche)';
```

⚠️ Remarque : la table doit avoir une contrainte unique sur `(source, reference)` ; le `DELETE` doit donc tourner avant tout futur insert. À vérifier au moment de la migration ; si la contrainte manque, on l'ajoute après dédup.

## Fichiers touchés

```text
supabase/functions/upsert-tenders/index.ts   ← cleanReference + filtre génériques
supabase/functions/scrape-list/index.ts      ← prompt Firecrawl renforcé
src/pages/TenderDetail.tsx                   ← bouton conditionnel + isGenericLink
supabase/migrations/<timestamp>_clean_refs_and_dedup.sql
```

## Effet attendu

- L'AO `2026A0210` affichera `dce_url = …refPub=MPI-pub-20260801257…` → "Voir l'avis original" ouvre la **bonne fiche**.
- Plus de doublons `2026A0210` / `réf. 2026A0210` à l'avenir.
- Si Firecrawl ne trouve qu'un lien générique, le bouton est simplement masqué au lieu d'envoyer l'utilisateur sur une page sans rapport.

