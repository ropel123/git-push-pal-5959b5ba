# Templates d'emails Auth — HackAO

Emails transactionnels Supabase Auth aux couleurs de la DA « Premium SaaS »
(blanc + dégradé `#2563EB → #4F46E5 → #7C3AED`, police Inter, HTML en tableaux
pour la compatibilité Outlook / Gmail / Apple Mail).

## Fichiers

| Fichier | Modèle Supabase à remplacer |
|---|---|
| `confirm-signup.html` | **Confirm signup** (validation de compte) |
| `reset-password.html` | **Reset password** (mot de passe oublié) |

## Installation (2 min, sans code)

1. Ouvrir le **dashboard Supabase** → projet HackAO.
2. Aller dans **Authentication → Emails** (ou *Email Templates*).
3. Sélectionner le modèle **Confirm signup**, passer l'éditeur en mode **HTML/source**,
   remplacer tout le contenu par celui de `confirm-signup.html`, puis **Save**.
4. Répéter pour **Reset password** avec `reset-password.html`.

## Variables utilisées

Les templates utilisent les variables standard de Supabase Auth, laissées telles quelles :

- `{{ .ConfirmationURL }}` — lien d'action (confirmation / réinitialisation).
- `{{ .SiteURL }}`, `{{ .Email }}`, `{{ .Token }}` — disponibles si besoin.

## Bon à savoir

- **Délivrabilité** : par défaut Supabase envoie via son SMTP mutualisé (quota
  limité, risque de spam). Pour la production, configurer un **SMTP dédié**
  (Resend, Postmark, Brevo…) dans *Authentication → SMTP Settings*. Le design
  des templates reste identique quel que soit l'expéditeur.
- **Redirections** : vérifier que l'URL de l'app est bien dans
  *Authentication → URL Configuration → Redirect URLs* pour que le lien de
  confirmation retombe sur le bon domaine.
- Les dégradés CSS ne s'affichent pas sur les très vieux clients (Outlook
  Windows) : un aplat bleu `#2563EB` prend le relais (défini via `bgcolor`).
