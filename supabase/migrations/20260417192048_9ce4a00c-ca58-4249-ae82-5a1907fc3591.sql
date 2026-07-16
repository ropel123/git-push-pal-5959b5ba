-- 1. Add config column to agent_playbooks for per-playbook flags (continue_on_error, etc.)
ALTER TABLE public.agent_playbooks
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Update MPI playbook : act → act_if_present for optional steps + continue_on_error
UPDATE public.agent_playbooks
SET
  config = '{"continue_on_error": true}'::jsonb,
  steps = '[
    {"action":"navigate","instruction":"Ouvrir l''URL DCE fournie"},
    {"action":"wait","timeout_ms":2000},
    {"action":"click_if_present","instruction":"Télécharger le DCE / Accès au DCE / Documents de la consultation"},
    {"action":"wait_for_inputs","min":2,"timeout_ms":8000},
    {"action":"fill_anonymous_identity"},
    {"action":"act_if_present","natural":"Cocher toutes les cases obligatoires (CGU, accepter les conditions, certifier les informations) si présentes"},
    {"action":"solve_image_captcha_if_present"},
    {"action":"click_if_present","instruction":"RETRAIT, retirer, télécharger le DCE"},
    {"action":"act_if_present","natural":"Cliquer sur le bouton final RETRAIT ou TÉLÉCHARGER pour récupérer le ZIP du DCE"},
    {"action":"wait_download","timeout_ms":75000}
  ]'::jsonb,
  updated_at = now()
WHERE platform = 'mpi';

-- 3. Update generic fallback playbook with same resilience
UPDATE public.agent_playbooks
SET
  config = '{"continue_on_error": true}'::jsonb,
  steps = '[
    {"action":"navigate","instruction":"Ouvrir l''URL DCE fournie"},
    {"action":"wait","timeout_ms":2000},
    {"action":"click_if_present","instruction":"Télécharger le DCE, Accès au DCE, Documents de la consultation, Retirer le dossier"},
    {"action":"wait_for_inputs","min":1,"timeout_ms":6000},
    {"action":"fill_anonymous_identity"},
    {"action":"act_if_present","natural":"Accepter les CGU / cocher les cases obligatoires si présentes"},
    {"action":"solve_image_captcha_if_present"},
    {"action":"click_if_present","instruction":"RETRAIT, retirer, télécharger, valider"},
    {"action":"act_if_present","natural":"Cliquer sur le bouton final de téléchargement / retrait du ZIP DCE"},
    {"action":"wait_download","timeout_ms":75000}
  ]'::jsonb,
  updated_at = now()
WHERE platform = 'generic';