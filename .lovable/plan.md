

# Édition des URLs de sourcing

Ajout d'une fonction "Modifier" sur chaque ligne de la table `/sourcing`, en plus des plans déjà actés (badges détaillés + job d'attribution).

## Nouveau bouton "Éditer"

Dans la colonne Actions de chaque URL, ajouter une icône crayon (`Pencil` de `lucide-react`) entre `Wand2` et `FlaskConical`.

Au clic → ouvre un Dialog d'édition pré-rempli avec les valeurs actuelles.

## Dialog "Modifier l'URL"

Mêmes champs que le dialog d'ajout, mais pré-remplis :

- **URL** (`Input`) — modifiable
- **Plateforme** (`Select` sur `PLATFORMS`) — modifiable, avec un bouton "Auto-détecter" qui relance `detectPlatform(url)` sur la valeur courante
- **Nom affiché** (`Input`) — modifiable
- **Fréquence (heures)** (`Input number`) — modifiable
- **Actif** (`Switch`) — modifiable (doublon du switch de la table, mais pratique ici)

Footer : `Annuler` + `Enregistrer`.

## Logique côté front

- Nouvel état `editing: SourcingUrl | null`.
- `openEdit(u)` → set `editing` + remplit un `editForm`.
- `saveEdit()` → `supabase.from("sourcing_urls").update({ url, platform, display_name, frequency_hours, is_active }).eq("id", editing.id)` puis `load()` + toast.
- Si l'URL change, on **réinitialise** `last_run_at`, `last_status`, `last_items_found`, `last_items_inserted`, `last_error` à `null` (les anciens stats ne valent plus pour la nouvelle URL).

## Garde-fou

- Validation : URL non vide, doit commencer par `http`.
- Si la nouvelle URL existe déjà sur une autre ligne → toast d'erreur (la contrainte unique en base remonte de toute façon, on l'affiche proprement).

## Fichier concerné

```text
src/pages/Sourcing.tsx   ← +bouton Pencil, +Dialog edit, +saveEdit()
```

Pas de migration SQL, pas de modif edge function : la table `sourcing_urls` accepte déjà ces UPDATE via les policies admin existantes.

## Rappel des autres chantiers en attente

Pour mémoire (pas inclus dans cette passe, à confirmer après) :
1. Badges détaillés `3 nouv · 7 MAJ · 0 skip` + tooltip diagnostic.
2. Job d'attribution (détecter les AO `awarded` après deadline).

Dis-moi si tu veux qu'on enchaîne sur l'un des deux après l'édition, ou si on s'en tient à l'édition pour l'instant.

