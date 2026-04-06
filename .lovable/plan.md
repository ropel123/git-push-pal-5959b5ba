

# Test DCE sur 2 AO + Comparatif Firecrawl vs Alternatives

## Probleme actuel

La function `fetch-dce` requiert un JWT utilisateur — impossible de la tester depuis le backend sans etre connecte. Il faut d'abord la rendre testable.

## Etape 1 — Rendre la function testable (mode batch/service)

Ajouter un mode "service_role" a `fetch-dce` : si le header `Authorization` contient la service_role_key, on bypass la verification utilisateur et on utilise un user_id systeme. Ca permet de tester depuis curl ou depuis une autre edge function.

## Etape 2 — Tester sur 2 AO reelles

**AO #1 — AchatPublic (URL avec ID)** :
`https://www.achatpublic.com/sdm/ent/gen/ent_detail.do?PCSLID=CSL_2026_cd4RDXKGRr`
→ "ACHAT DE 3 SELFS POUR ENFANTS" — Ville de Creteil

**AO #2 — MPI/AWS (URL avec IDM)** :
`https://www.marches-publics.info/mpiaws/index.cfm?fuseaction=dematent.login&type=Dce&Idm=1791571`
→ "FOURNITURE ET LIVRAISON DE JEUX ET JOUETS" — Departement de la Sarthe

On appelle la function, on log les resultats (fichiers telecharges ? enrichissement ? erreur ?) et on met a jour le plan.

## Comparatif : Firecrawl vs Alternatives

### Firecrawl (actuel)
| Aspect | Evaluation |
|--------|-----------|
| Scraping pages JS-rendered | Bon — headless browser integre |
| Extraction de liens/PDF | Moyen — regex sur les liens trouves |
| Contournement CAPTCHA | Non |
| Interaction (cliquer, remplir formulaire) | Non — lecture seule |
| Cout | ~0.01$/page scraped |

**Verdict** : Firecrawl est parfait pour scraper du contenu textuel et trouver des liens. Mais il ne peut pas **interagir** avec les pages (cliquer sur "Retirer le DCE", remplir un formulaire anonyme, etc.).

### Perplexity API
| Aspect | Evaluation |
|--------|-----------|
| Ce que c'est | Moteur de recherche IA |
| Scraping de page specifique | Non — il cherche sur le web, il ne scrape pas une URL donnee |
| Telechargement de fichiers | Non |

**Verdict** : Perplexity est inutile ici. C'est un moteur de recherche, pas un scraper. Il ne peut pas telecharger un PDF depuis une plateforme de marches publics.

### OpenAI Computer Use / Claude Computer Use
| Aspect | Evaluation |
|--------|-----------|
| Interaction avec pages | Oui — peut cliquer, remplir des formulaires |
| Navigation complexe | Oui — comprend le contexte visuel |
| Contournement CAPTCHA | Non (interdit par ToS) |
| Cout | Eleve (~0.05-0.20$ par interaction) |
| Disponibilite en Edge Function | Non — necessite un runtime long (pas compatible Deno/60s timeout) |

**Verdict** : Tres puissant mais trop lent et trop cher pour du batch. Ideal pour un "mode assiste" ou l'agent navigue a la demande de l'utilisateur sur UNE plateforme specifique.

### Browserbase / Puppeteer headless
| Aspect | Evaluation |
|--------|-----------|
| Interaction avec pages | Oui — scripting complet |
| Navigation formulaire | Oui |
| Cout | ~0.01-0.05$/session |
| Complexite | Haute — faut ecrire un script par plateforme |

**Verdict** : La meilleure option technique pour du batch automatise. Mais demande du dev par plateforme.

## Recommandation : Approche hybride en 3 niveaux

```text
Niveau 1 — Firecrawl (garder)
  → Scrape la page, extrait les metadonnees, trouve les liens directs
  → Fonctionne pour ~30% des AO (liens PDF directs)
  → Enrichit les donnees pour 70%+ des AO

Niveau 2 — Scripts Browserbase (a ajouter plus tard)
  → Pour MPI "mode anonyme" et PLACE "telecharger RC"
  → Scripts specifiques par plateforme
  → Couvre ~40% des AO supplementaires

Niveau 3 — Agent IA (Claude/GPT Computer Use) (futur)
  → Pour les cas complexes ou l'utilisateur veut recuperer le DCE
  → L'agent navigue visuellement la plateforme
  → Mode interactif, pas batch
```

## Plan d'implementation immediat

1. **Modifier `fetch-dce`** : ajouter mode service_role pour tests batch
2. **Tester sur les 2 AO** ci-dessus et analyser les resultats
3. **Affiner les adapteurs** selon ce que Firecrawl arrive reellement a scraper
4. **Garder Firecrawl** pour le niveau 1 — c'est le bon outil pour ce qu'il fait

## Fichiers a modifier

- `supabase/functions/fetch-dce/index.ts` — ajouter mode service_role + ameliorer les adapteurs
- Deployer et tester sur les 2 AO

