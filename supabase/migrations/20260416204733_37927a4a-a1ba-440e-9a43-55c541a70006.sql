UPDATE public.agent_playbooks
SET steps = '[
  {"action":"goto","target":"{{dce_url}}"},
  {"action":"wait","timeout_ms":2500},
  {"action":"click_if_present","instruction":"Accepte les cookies si une bannière de cookies est présente"},
  {"action":"act","instruction":"Clique sur le bouton de téléchargement du DCE (Télécharger le DCE, Retirer le dossier, Retrait anonyme, Accéder au dossier de consultation, Dossier de consultation) — surtout PAS un onglet de menu de navigation"},
  {"action":"wait","timeout_ms":3000},
  {"action":"click_if_present","instruction":"Option Retrait anonyme, Sans identification, Accès libre, ou Téléchargement sans compte (uniquement si une telle option est proposée)"},
  {"action":"wait","timeout_ms":2500},
  {"action":"click_if_present","instruction":"Bouton Continuer / Suivant / Valider le choix anonyme (étape intermédiaire après sélection du mode de retrait, AVANT le formulaire d''identité)"},
  {"action":"wait_for_inputs","min":2,"timeout_ms":8000},
  {"action":"fill_anonymous_identity"},
  {"action":"wait","timeout_ms":2000},
  {"action":"solve_captcha_if_present"},
  {"action":"click_if_present","instruction":"Coche la case d''acceptation des conditions générales d''utilisation si elle est présente"},
  {"action":"act","instruction":"Bouton SUBMIT final du formulaire de retrait DCE : input[type=submit] ou button[type=submit] avec texte Valider / Télécharger / Confirmer / Envoyer / Soumettre. PAS un bouton Annuler, PAS un onglet de menu, PAS un lien de navigation"},
  {"action":"wait_download","timeout_ms":30000}
]'::jsonb,
updated_at = now()
WHERE platform = 'maximilien';