
INSERT INTO public.agent_playbooks (platform, display_name, url_pattern, requires_auth, requires_captcha, is_active, steps)
VALUES
(
  'place',
  'PLACE — marches-publics.gouv.fr',
  'place.marches-publics.gouv.fr',
  false,
  false,
  true,
  '[
    {"action":"goto","target":"{{dce_url}}"},
    {"action":"wait","timeout_ms":2000},
    {"action":"act","instruction":"Clique sur le bouton ou lien permettant d''accéder au téléchargement du DCE (Dossier de Consultation des Entreprises)"},
    {"action":"wait","timeout_ms":2000},
    {"action":"act","instruction":"Si une case à cocher d''acceptation des conditions est présente, coche-la, puis clique sur le bouton de téléchargement / valider"},
    {"action":"wait_download","timeout_ms":30000}
  ]'::jsonb
),
(
  'atexo_achatpublic',
  'Atexo — achatpublic.com',
  'achatpublic.com',
  true,
  true,
  true,
  '[
    {"action":"goto","target":"{{dce_url}}"},
    {"action":"wait","timeout_ms":2000},
    {"action":"act","instruction":"Clique sur le bouton ''Télécharger le DCE'' ou équivalent"},
    {"action":"wait","timeout_ms":1500},
    {"action":"fill_login"},
    {"action":"wait","timeout_ms":2500},
    {"action":"solve_captcha_if_present"},
    {"action":"act","instruction":"Coche les cases d''acceptation des conditions générales si présentes, puis clique sur le bouton de validation / téléchargement"},
    {"action":"wait_download","timeout_ms":40000}
  ]'::jsonb
)
ON CONFLICT DO NOTHING;
