-- 1. Renomme l'ancien playbook 'atexo_achatpublic' en 'atexo_spl' (Atexo SPL générique pour Meuse, etc.)
--    et retire achatpublic.com de son url_pattern.
UPDATE public.agent_playbooks
SET platform = 'atexo_spl',
    display_name = 'Atexo SPL (profils acheteurs)',
    url_pattern = 'profilacheteur\.|atexo'
WHERE platform = 'atexo_achatpublic';

-- 2. Nouveau playbook dédié à www.achatpublic.com (éditeur indépendant, flow simple anonyme)
INSERT INTO public.agent_playbooks (
  platform, display_name, url_pattern,
  requires_auth, requires_captcha, is_active,
  confidence, version, steps
) VALUES (
  'achatpublic',
  'AchatPublic.com',
  '(^|//)(www\.)?achatpublic\.com',
  false, false, true,
  0.9, 1,
  '[
    {"action":"goto","target":"{{dce_url}}"},
    {"action":"wait","timeout_ms":3500},
    {"action":"click_last","instruction":"télécharger"},
    {"action":"wait","timeout_ms":2000},
    {"action":"click","instruction":"non"},
    {"action":"wait_download","timeout_ms":30000}
  ]'::jsonb
)
ON CONFLICT DO NOTHING;