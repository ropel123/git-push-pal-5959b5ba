

## Réponse courte

**Oui, l'agent peut le faire — mais pas tout seul aujourd'hui.** Le screenshot montre une page **AWS-Achat / marches-publics.info (MPI)** avec :

1. Formulaire d'identification anonyme (nom/email/société)
2. **CAPTCHA image obligatoire** ("WR7XEH" en visuel déformé sur fond rose)
3. Bouton RETRAIT pour télécharger le DCE

## État actuel des capacités

| Capacité | Statut |
|---|---|
| Naviguer sur MPI | ✅ Playbook `mpi` créé (migration précédente) |
| Remplir formulaire anonyme | ✅ Géré par étape `act` LLM-first |
| Cocher cases / accepter CGU | ✅ Géré |
| Cliquer RETRAIT + attendre ZIP | ✅ Géré (`wait_download`) |
| **Résoudre le CAPTCHA image** | ⚠️ **Partiel** — secret `TWOCAPTCHA_API_KEY` configuré mais **pas appelé** dans le playbook MPI ni dans `fetch-dce-agent` |

## Le vrai gap : résolution CAPTCHA

Le CAPTCHA visible sur ton screenshot est un **CAPTCHA image classique** (pas reCAPTCHA, pas hCaptcha). Pour le résoudre, il faut :

1. **Détecter** le `<img>` du CAPTCHA dans la page
2. **Capturer** l'image (screenshot ciblé ou téléchargement direct du src)
3. **L'envoyer à 2Captcha** (`POST https://2captcha.com/in.php` avec `method=base64`)
4. **Poller** jusqu'à obtenir le texte décodé (~10-30 sec, ~0,001 $)
5. **Remplir** le champ "Texte de l'image" avec le résultat
6. **Cliquer** RETRAIT

Ce flux n'existe pas encore dans `fetch-dce-agent`. Le playbook MPI actuel suppose qu'il n'y a pas de captcha (`requires_captcha: false`).

## Plan de correction

### 1. Helper `solveImageCaptcha` dans l'agent
Ajouter une fonction utilitaire dans `supabase/functions/fetch-dce-agent/index.ts` :
- Prend un sélecteur (ou screenshot de zone)
- Convertit en base64
- POST à 2Captcha API
- Poll `res.php` jusqu'à résolution
- Retourne le texte

### 2. Nouvelle action `solve_captcha` dans le moteur de playbook
Étendre le switch d'actions pour gérer un step type :
```json
{"action":"solve_captcha","captcha_type":"image","image_selector":"img[src*='captcha']","input_selector":"input[name='captcha_text']"}
```

### 3. Mettre à jour le playbook MPI
- Passer `requires_captcha: true`
- Insérer un step `solve_captcha` entre le remplissage du formulaire et le clic RETRAIT
- Migration SQL d'update

### 4. Tracking coût + traçabilité
- Logger chaque résolution captcha dans `agent_runs.trace` (prix, durée, succès)
- Compter dans `captchas_solved` (déjà présent dans le retour de l'agent)

### 5. Fallback heuristique LLM-vision
Si 2Captcha échoue, demander à Claude (vision) de lire l'image — moins fiable sur captchas déformés mais utile en backup.

## Fichiers touchés

- **`supabase/functions/fetch-dce-agent/index.ts`** : helper `solveImageCaptcha` + handler d'action `solve_captcha` + intégration trace/coût
- **Migration SQL** : `UPDATE agent_playbooks SET steps = ..., requires_captcha = true WHERE platform = 'mpi'`
- **(optionnel) `src/pages/AgentMonitor.tsx`** : afficher nb captchas résolus + coût par run

## Coût attendu

- 2Captcha image classique : **~0,001 $/captcha** (1000 captchas pour 1 $)
- Latence : 10-30 sec par résolution
- Taux de succès attendu : >90 % sur captchas image type AWS

## Prêt à exécuter

Je peux implémenter dans l'ordre : helper + action `solve_captcha` → migration update playbook MPI → test sur l'URL Dordogne du screenshot. **Donne le go pour passer en mode édition.**

