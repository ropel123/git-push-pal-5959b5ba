-- 1. Table agent_anonymous_identity
CREATE TABLE IF NOT EXISTS public.agent_anonymous_identity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  company_name TEXT NOT NULL,
  siret TEXT,
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  phone TEXT,
  is_default BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.agent_anonymous_identity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage anonymous identity"
ON public.agent_anonymous_identity
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_agent_anonymous_identity_updated_at
BEFORE UPDATE ON public.agent_anonymous_identity
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed identité par défaut Hackify
INSERT INTO public.agent_anonymous_identity (email, company_name, siret, last_name, first_name, phone, is_default)
VALUES ('contact@hackify.fr', 'Hackify', '90000000000000', 'Hackify', 'Agent', '0100000000', true)
ON CONFLICT DO NOTHING;

-- 2. Mise à jour des playbooks : passage en mode anonyme
UPDATE public.agent_playbooks
SET requires_auth = false,
    steps = '[
      {"action":"goto","target":"{{dce_url}}"},
      {"action":"wait","timeout_ms":2000},
      {"action":"click_if_present","instruction":"Accepte les cookies si une bannière de cookies est présente"},
      {"action":"act","instruction":"Clique sur le bouton ou lien permettant de télécharger le DCE (libellés possibles: Télécharger le DCE, Téléchargement, Retirer le dossier, Accéder au dossier de consultation, Retrait anonyme)"},
      {"action":"wait","timeout_ms":2500},
      {"action":"fill_anonymous_identity"},
      {"action":"wait","timeout_ms":1500},
      {"action":"solve_captcha_if_present"},
      {"action":"click_if_present","instruction":"Coche la case d''acceptation des conditions générales d''utilisation si elle est présente"},
      {"action":"act","instruction":"Valide le formulaire pour lancer le téléchargement du DCE (bouton Valider, Télécharger, Confirmer, Suivant)"},
      {"action":"wait_download","timeout_ms":25000}
    ]'::jsonb
WHERE platform = 'maximilien';

UPDATE public.agent_playbooks
SET requires_auth = false,
    steps = '[
      {"action":"goto","target":"{{dce_url}}"},
      {"action":"wait","timeout_ms":2000},
      {"action":"click_if_present","instruction":"Accepte les cookies si une bannière de cookies est présente"},
      {"action":"act","instruction":"Clique sur le bouton ou lien permettant de télécharger le dossier de consultation (DCE), choisis le retrait anonyme si proposé"},
      {"action":"wait","timeout_ms":2500},
      {"action":"fill_anonymous_identity"},
      {"action":"wait","timeout_ms":1500},
      {"action":"solve_captcha_if_present"},
      {"action":"click_if_present","instruction":"Coche la case d''acceptation des conditions si elle est présente"},
      {"action":"act","instruction":"Valide le formulaire pour lancer le téléchargement"},
      {"action":"wait_download","timeout_ms":25000}
    ]'::jsonb
WHERE platform = 'megalis';

UPDATE public.agent_playbooks
SET requires_auth = false,
    steps = '[
      {"action":"goto","target":"{{dce_url}}"},
      {"action":"wait","timeout_ms":2000},
      {"action":"click_if_present","instruction":"Accepte les cookies si une bannière de cookies est présente"},
      {"action":"act","instruction":"Clique sur le lien de retrait du DCE (libellés: Retrait du DCE, Télécharger le DCE, Téléchargement du dossier, Retrait anonyme)"},
      {"action":"wait","timeout_ms":2500},
      {"action":"fill_anonymous_identity"},
      {"action":"wait","timeout_ms":1500},
      {"action":"solve_captcha_if_present"},
      {"action":"click_if_present","instruction":"Coche les cases d''acceptation des conditions si elles sont présentes"},
      {"action":"act","instruction":"Valide le formulaire pour lancer le téléchargement du DCE"},
      {"action":"wait_download","timeout_ms":25000}
    ]'::jsonb
WHERE platform = 'marches_securises';

-- Atexo (achatpublic + localtrust) : passe aussi en anonyme
UPDATE public.agent_playbooks
SET requires_auth = false,
    steps = (
      SELECT jsonb_agg(
        CASE WHEN s->>'action' = 'fill_login'
             THEN '{"action":"fill_anonymous_identity"}'::jsonb
             ELSE s
        END
      )
      FROM jsonb_array_elements(steps) s
    )
WHERE platform IN ('atexo_achatpublic', 'atexo_localtrust', 'atexo');