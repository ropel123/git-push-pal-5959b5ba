INSERT INTO public.agent_playbooks (platform, display_name, url_pattern, requires_auth, requires_captcha, is_active, steps)
VALUES
(
  'maximilien',
  'Maximilien (Île-de-France)',
  'maximilien.fr',
  true,
  true,
  true,
  '[
    {"action":"goto","target":"{{dce_url}}"},
    {"action":"wait","timeout_ms":2000},
    {"action":"click_if_present","instruction":"Accepte les cookies si une bannière de cookies est présente"},
    {"action":"act","instruction":"Clique sur le bouton ou lien permettant de télécharger le DCE (libellés possibles: Télécharger le DCE, Téléchargement, Retirer le dossier, Accéder au dossier de consultation)"},
    {"action":"wait","timeout_ms":2000},
    {"action":"fill_login"},
    {"action":"wait","timeout_ms":2000},
    {"action":"solve_captcha_if_present"},
    {"action":"click_if_present","instruction":"Coche la case d''acceptation des conditions générales d''utilisation si elle est présente"},
    {"action":"act","instruction":"Valide le formulaire pour lancer le téléchargement du DCE (bouton Valider, Télécharger, Confirmer)"},
    {"action":"wait_download","timeout_ms":25000}
  ]'::jsonb
),
(
  'megalis',
  'Mégalis Bretagne',
  'megalis.bretagne.bzh',
  true,
  true,
  true,
  '[
    {"action":"goto","target":"{{dce_url}}"},
    {"action":"wait","timeout_ms":2000},
    {"action":"click_if_present","instruction":"Accepte les cookies si une bannière de cookies est présente"},
    {"action":"act","instruction":"Clique sur le bouton ou lien permettant de télécharger le dossier de consultation (DCE)"},
    {"action":"wait","timeout_ms":2000},
    {"action":"fill_login"},
    {"action":"wait","timeout_ms":2000},
    {"action":"solve_captcha_if_present"},
    {"action":"click_if_present","instruction":"Coche la case d''acceptation des conditions si elle est présente"},
    {"action":"act","instruction":"Valide le formulaire pour lancer le téléchargement"},
    {"action":"wait_download","timeout_ms":25000}
  ]'::jsonb
),
(
  'marches_securises',
  'Marchés-Sécurisés',
  'marches-securises.fr',
  true,
  false,
  true,
  '[
    {"action":"goto","target":"{{dce_url}}"},
    {"action":"wait","timeout_ms":2000},
    {"action":"click_if_present","instruction":"Accepte les cookies si une bannière de cookies est présente"},
    {"action":"act","instruction":"Clique sur le lien de retrait du DCE (libellés: Retrait du DCE, Télécharger le DCE, Téléchargement du dossier)"},
    {"action":"wait","timeout_ms":2000},
    {"action":"fill_login"},
    {"action":"wait","timeout_ms":2000},
    {"action":"solve_captcha_if_present"},
    {"action":"click_if_present","instruction":"Coche les cases d''acceptation des conditions si elles sont présentes"},
    {"action":"act","instruction":"Valide le formulaire pour lancer le téléchargement du DCE"},
    {"action":"wait_download","timeout_ms":25000}
  ]'::jsonb
)
ON CONFLICT DO NOTHING;