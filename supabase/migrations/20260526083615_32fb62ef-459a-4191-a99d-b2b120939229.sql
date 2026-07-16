UPDATE public.agent_playbooks
SET steps = '[
  {"action":"navigate","instruction":"Ouvrir l''URL DCE fournie"},
  {"action":"wait","timeout_ms":1500},
  {"action":"extract_href_and_navigate","matcher":"Dossier de Consultation des Entreprises","instruction":"Suivre le lien DCE vers marches-publics.info"},
  {"action":"wait","timeout_ms":2500},
  {"action":"solve_image_captcha_if_present"},
  {"action":"click_if_present","instruction":"RETRAIT ANONYME"},
  {"action":"click_if_present","instruction":"RETRAIT"},
  {"action":"wait","timeout_ms":2500},
  {"action":"branch_login_if_required"},
  {"action":"wait","timeout_ms":1500},
  {"action":"download_all_pieces"},
  {"action":"wait_download","timeout_ms":8000}
]'::jsonb,
config = jsonb_set(coalesce(config, '{}'::jsonb), '{continue_on_error}', 'true'::jsonb, true),
updated_at = now()
WHERE platform = 'mpi';