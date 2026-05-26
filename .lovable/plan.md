## Problème

Sur la page DCE AW Solutions / marches-publics.info, il y a deux chemins distincts :

1. **Identifié** (bloc du haut) : captcha + bouton `RETRAIT` → exige un compte → redirige vers `awsolutions.fr/auth/...` (écran "Connexion" visible photo 1).
2. **Anonyme** (lien en bas) : `retirer le DCE en mode anonyme` → mène à une page captcha seule, puis téléchargement direct sans login.

Le playbook actuel résout le captcha du bloc identifié et clique `RETRAIT` → l'agent tombe sur le login Keycloak et s'arrête en timeout.

## Correction

Modifier le playbook MPI (`agent_playbooks where platform='mpi'`) pour cliquer le lien anonyme **en premier**, puis traiter captcha + RETRAIT sur la page suivante.

Nouvelle séquence `steps` :

```
1. navigate(dce_url)
2. wait 1500ms
3. extract_href_and_navigate matcher="Dossier de Consultation"   (page DCE choixDCE)
4. wait 2000ms
5. extract_href_and_navigate matcher="mode anonyme"              (← NOUVEAU, force le chemin anonyme)
6. wait 2000ms
7. solve_image_captcha_if_present                                (captcha de la page anonyme)
8. click_if_present "RETRAIT"                                    (bouton final)
9. wait 3000ms
10. branch_login_if_required                                     (safety net — devrait être skipped)
11. wait 1500ms
12. download_all_pieces
13. wait_download 8000ms
```

Le matcher `extract_href_and_navigate` cherche déjà `textContent` / `title` en insensible à la casse → "mode anonyme" matchera le lien "retirer le DCE en mode anonyme".

## Changements

- **Migration SQL** : `UPDATE agent_playbooks SET steps = '...' WHERE platform='mpi'` avec la séquence ci-dessus. Pas de changement de `config`.
- **Aucun changement code** dans `fetch-dce-agent/index.ts` ni front — toutes les actions existent déjà.

## Vérification

Relancer l'agent sur le même DCE :
- trace doit contenir `extract_href_and_navigate ok — → ...mode_anonyme...`
- pas d'URL `awsolutions.fr/auth`
- `branch_login_if_required skipped`
- `download_all_pieces ok — N pièces`
- `files_downloaded > 0` dans `agent_runs` + entrées `dce_uploads`.
