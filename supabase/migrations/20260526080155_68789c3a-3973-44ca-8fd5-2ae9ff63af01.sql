UPDATE public.agent_playbooks
SET steps = '[
  {"action":"navigate","instruction":"Ouvrir l''URL DCE fournie"},
  {"action":"wait","timeout_ms":1500},
  {"action":"extract_href_and_navigate","matcher":"Dossier de Consultation des Entreprises","instruction":"Suivre le lien DCE vers marches-publics.info"},
  {"action":"wait","timeout_ms":2500},
  {"action":"wait_for_inputs","min":2,"timeout_ms":8000},
  {"action":"fill_login"},
  {"action":"click_if_present","instruction":"Se connecter / Connexion / Valider / OK"},
  {"action":"wait","timeout_ms":2000},
  {"action":"act_if_present","natural":"Cocher toutes les cases de sélection des lots disponibles"},
  {"action":"act_if_present","natural":"Cocher toutes les cases obligatoires (CGU, accepter les conditions, certifier les informations) si présentes"},
  {"action":"click_if_present","instruction":"Suivant / Valider / Continuer"},
  {"action":"wait","timeout_ms":1500},
  {"action":"solve_image_captcha_if_present"},
  {"action":"act_if_present","natural":"Cliquer sur le bouton final RETRAIT, TÉLÉCHARGER ou Télécharger le DCE pour récupérer le ZIP"},
  {"action":"wait_download","timeout_ms":75000}
]'::jsonb
WHERE platform = 'mpi';