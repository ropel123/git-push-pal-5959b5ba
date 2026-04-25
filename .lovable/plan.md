# Supprimer le seuil de confiance Anthropic

## Constat

Tu as raison : si Haiku 4.5 fait correctement son boulot (`web_fetch` + inspection du DOM), pour la quasi-totalité des plateformes la signature est explicite (`class="atexo-*"`, footer, hostname, scripts). Si l'agent renvoie `atexo` même à 0.72, il a très probablement raison — le filtrage par seuil nous fait juste perdre des bonnes réponses.

## Modification

**Un seul changement** dans `supabase/functions/_shared/aiClassifierAnthropic.ts` :

Supprimer le filtre qui rétrograde le verdict en `custom` quand `confidence < 0.65`. On garde **toujours** ce que l'agent renvoie. Seul cas où on tombe sur `custom` :
- L'agent renvoie explicitement `platform: "custom"` (il a inspecté et n'a rien trouvé d'identifiable)
- L'API Anthropic échoue (réseau, 5xx, key manquante) → fallback `custom` comme aujourd'hui

On log toujours la confidence basse (`console.warn`) pour pouvoir analyser plus tard, mais on ne jette plus le verdict.

## Toast simplifié dans `Sourcing.tsx`

Comme il n'y a plus de "low-conf rétrogradé", le toast revient à un format simple :
```
custom → atexo (ai 0.72 · anthropic)
```

Trois sources possibles seulement :
- `ai` : verdict de l'agent (que la confidence soit 0.6 ou 0.95)
- `regex` : détection par hostname/path avant même d'appeler l'IA
- `fallback` : erreur API → custom forcé

## Hors scope

- Aucun changement de prompt (l'agent a déjà toutes les instructions nécessaires)
- Aucun changement de modèle (on reste sur Haiku 4.5)
- OpenRouter / Opus inchangé
