update public.agent_playbooks
set steps = '[
  {"action":"navigate","instruction":"Ouvrir l''URL DCE fournie"},
  {"action":"wait","timeout_ms":2000},
  {"action":"click_if_present","instruction":"Dossier de Consultation des Entreprises / Télécharger le DCE / Accès au DCE / Documents de la consultation"},
  {"action":"wait","timeout_ms":1500},
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
]'::jsonb,
updated_at = now()
where platform = 'mpi';