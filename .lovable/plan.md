

# Audit TED complet — Maximiser l'extraction Search API + diagnostic

## Approche hybride validée

Tu as raison : l'API Search retourne des données parsées, pas le XML brut. Certains champs demandés pourraient ne pas être retournés. L'approche est donc :

1. **Phase 1** : Demander TOUS les champs potentiellement disponibles via Search API
2. **Phase 2** : Logger ce qui revient réellement pour diagnostiquer les gaps
3. **Phase 3** : Enrichir le normalizer avec les nouveaux champs

## Champs à ajouter au `fields` array (~20 nouveaux)

```text
Catégorie              | Champ API                              | Probabilité
-----------------------|----------------------------------------|------------
Critères attribution   | award-criterion-description-lot        | ✅ Haute
Exclusion              | exclusion-grounds                      | ⚠️ Moyenne
Exclusion desc         | exclusion-grounds-description          | ⚠️ Moyenne
Conditions financières | terms-financial-lot                    | ⚠️ Moyenne
Conditions exécution   | term-performance-lot                   | ⚠️ Moyenne
Titre lot              | title-lot                              | ✅ Haute
ID interne lot         | internal-identifier-lot                | ✅ Haute
Montant procédure      | estimated-value-proc                   | ✅ Haute
Valeur max accord-cadre| framework-maximum-value-lot            | ⚠️ Moyenne
Options lot            | option-description-lot                 | ⚠️ Moyenne
Reconductions          | renewal-description-lot                | ⚠️ Moyenne
Date conclusion        | contract-conclusion-date               | ⚠️ Moyenne
ID contrat             | contract-identifier                    | ⚠️ Moyenne
Sous-traitance desc    | subcontracting-description             | ⚠️ Moyenne
Sous-traitance montant | subcontracting-value                   | ⚠️ Moyenne
Rang offre             | tender-rank                            | ⚠️ Moyenne
Type juridique acheteur| buyer-legal-type                       | ⚠️ Moyenne
Profil acheteur URL    | buyer-profile                          | ⚠️ Moyenne
URL documents lot      | document-url-lot                       | ⚠️ Moyenne
URL dépôt offres       | submission-url-lot                     | ⚠️ Moyenne
Info complémentaire    | additional-info-proc                   | ⚠️ Moyenne
Identifiant gagnant    | organisation-identifier-tenderer       | ⚠️ Moyenne
```

## Corrections dans `scrape-ted/index.ts`

### 1. Diagnostic logging (première exécution)
Ajouter un log qui dump les clés réellement retournées par l'API pour la première notice de chaque page :
```
console.log("[scrape-ted] Sample notice keys:", Object.keys(notices[0]));
```
Permet de voir exactement quels champs l'API retourne vraiment.

### 2. Enrichir le `fields` array (+20 champs)
Ajouter tous les champs listés ci-dessus. L'API ignore silencieusement les champs inconnus, donc aucun risque.

### 3. Enrichir `normalizeTedToTender`

**Critères d'attribution** : combiner `award-criterion-name-lot` + `award-criterion-description-lot` + poids. Format :
```
Valeur technique (45%) : Mémoire technique détaillant...
Prix (40%) : Prix global forfaitaire
Environnement (15%) : Performances en matière de...
```

**Conditions de participation** : enrichir avec `exclusion-grounds-description`, `terms-financial-lot`, `term-performance-lot` en sections.

**Lots enrichis** : chaque lot reçoit `title-lot`, `internal-identifier-lot`, montant estimatif, options, reconductions.

**Montant** : fallback `estimated-value-proc` quand `estimated-value-lot` absent.

**Award enrichi** : ajouter `winner_siren` (depuis `organisation-identifier-tenderer`), `contract-conclusion-date`, sous-traitance.

**Acheteur** : ajouter `buyer-legal-type`, `buyer-profile` dans `buyer_contact`.

**Additional info** : enrichir avec `additional-info-proc`, `document-url-lot`, `submission-url-lot`, options, reconductions.

### 4. Structure lots améliorée
```typescript
lots = lotTitles.map((title, i) => ({
  numero: i + 1,
  titre: title,
  identifiant: lotIds[i],
  description: lotDescs[i],
  montant_estime: lotValues[i],
  options: lotOptions[i],
  reconductions: lotRenewals[i],
}));
```

## Fichier modifié
- `supabase/functions/scrape-ted/index.ts`

## Post-déploiement
- Déployer et exécuter le scraper
- Vérifier les logs pour voir quels champs sont réellement retournés
- Ajuster si certains champs ne sont pas disponibles

