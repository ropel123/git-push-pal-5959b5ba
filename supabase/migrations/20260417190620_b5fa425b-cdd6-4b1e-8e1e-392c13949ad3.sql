
INSERT INTO public.agent_playbooks (platform, display_name, url_pattern, is_active, requires_auth, requires_captcha, steps)
VALUES
  (
    'mpi',
    'MPI / AWS achat (marches-publics.info)',
    'marches-publics\.info',
    true,
    false,
    false,
    '[
      {"action":"navigate","instruction":"Ouvrir l''URL DCE fournie"},
      {"action":"act","natural":"Si une page d''accueil/consultation s''affiche, cliquer sur ''Télécharger le DCE'' ou ''Accès au DCE''"},
      {"action":"act","natural":"Si un formulaire d''identification anonyme apparaît, remplir nom/prénom/email/société avec l''identité anonyme fournie et valider"},
      {"action":"act","natural":"Accepter les conditions / cocher les cases obligatoires si présentes"},
      {"action":"act","natural":"Cliquer sur le bouton de téléchargement final du ZIP du DCE"},
      {"action":"wait_download","timeout_ms":60000}
    ]'::jsonb
  ),
  (
    'generic',
    'Generic LLM-first (fallback universel)',
    '.*',
    true,
    false,
    false,
    '[
      {"action":"navigate","instruction":"Ouvrir l''URL DCE fournie"},
      {"action":"act","natural":"Identifier et cliquer sur le lien/bouton permettant de télécharger le dossier de consultation (DCE), souvent intitulé ''Télécharger le DCE'', ''Accès au DCE'', ''Documents de la consultation'' ou similaire"},
      {"action":"act","natural":"Si un formulaire d''accès anonyme s''affiche, le remplir avec l''identité fournie (nom, prénom, email, société) et valider"},
      {"action":"act","natural":"Accepter les conditions générales et cocher toutes les cases obligatoires éventuelles"},
      {"action":"act","natural":"Cliquer sur le bouton final de téléchargement du ZIP contenant tous les documents"},
      {"action":"wait_download","timeout_ms":75000}
    ]'::jsonb
  )
ON CONFLICT DO NOTHING;
