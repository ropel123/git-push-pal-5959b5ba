UPDATE public.agent_playbooks
SET
  requires_captcha = true,
  steps = '[
    {"action":"navigate","instruction":"Ouvrir l''URL DCE fournie"},
    {"action":"wait","timeout_ms":2000},
    {"action":"click_if_present","instruction":"Télécharger le DCE / Accès au DCE / Documents de la consultation"},
    {"action":"wait_for_inputs","min":2,"timeout_ms":8000},
    {"action":"fill_anonymous_identity"},
    {"action":"act","natural":"Cocher toutes les cases obligatoires (CGU, accepter les conditions, certifier les informations) si présentes"},
    {"action":"solve_image_captcha_if_present"},
    {"action":"act","natural":"Cliquer sur le bouton final RETRAIT ou TÉLÉCHARGER pour récupérer le ZIP du DCE"},
    {"action":"wait_download","timeout_ms":75000}
  ]'::jsonb,
  updated_at = now()
WHERE platform = 'mpi';

-- Also enrich the generic fallback to attempt image-captcha resolution opportunistically
UPDATE public.agent_playbooks
SET
  steps = '[
    {"action":"navigate","instruction":"Ouvrir l''URL DCE fournie"},
    {"action":"wait","timeout_ms":2000},
    {"action":"click_if_present","instruction":"Télécharger le DCE, Accès au DCE, Documents de la consultation, Retirer le dossier"},
    {"action":"wait_for_inputs","min":1,"timeout_ms":6000},
    {"action":"fill_anonymous_identity"},
    {"action":"act","natural":"Accepter les CGU / cocher les cases obligatoires si présentes"},
    {"action":"solve_image_captcha_if_present"},
    {"action":"act","natural":"Cliquer sur le bouton final de téléchargement / retrait du ZIP DCE"},
    {"action":"wait_download","timeout_ms":75000}
  ]'::jsonb,
  updated_at = now()
WHERE platform = 'generic';