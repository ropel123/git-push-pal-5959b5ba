UPDATE public.agent_playbooks
SET steps = '[
  {"action":"goto","target":"{{dce_url}}"},
  {"action":"wait","timeout_ms":2500},
  {"action":"click_if_present","instruction":"Accepte les cookies si une bannière de cookies est présente"},
  {"action":"act","instruction":"Clique sur le bouton de téléchargement du DCE (Télécharger le DCE, Retirer le dossier, Retrait anonyme, Accéder au dossier de consultation) — surtout PAS un onglet de menu de navigation"},
  {"action":"wait","timeout_ms":3000},
  {"action":"act","instruction":"Si une option Retrait anonyme ou Sans identification est proposée, clique dessus"},
  {"action":"wait","timeout_ms":1500},
  {"action":"fill_anonymous_identity"},
  {"action":"wait","timeout_ms":1500},
  {"action":"solve_captcha_if_present"},
  {"action":"click_if_present","instruction":"Coche la case d''acceptation des conditions générales d''utilisation si elle est présente"},
  {"action":"act","instruction":"Clique sur le bouton de validation finale du formulaire pour lancer le téléchargement (Valider, Télécharger, Confirmer, Envoyer) — bouton de soumission, pas un lien de menu"},
  {"action":"wait_download","timeout_ms":25000}
]'::jsonb,
updated_at = now()
WHERE platform = 'maximilien';