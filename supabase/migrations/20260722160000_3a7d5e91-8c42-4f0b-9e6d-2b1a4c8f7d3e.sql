-- Relais d'ingestion BOAMP via la base : le worker edge ne peut pas émettre
-- de requête sortante après avoir rendu sa réponse (le runtime la tue —
-- vérifié en logs : aucun hop suivant n'arrivait). Cette fonction, appelée
-- par fetch-boamp juste avant de répondre, fait envoyer l'invocation
-- suivante par pg_net depuis Postgres, indépendamment du worker.
-- (Exécutée directement en production le 2026-07-22.)

CREATE OR REPLACE FUNCTION public.relay_fetch_boamp(next_url text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Garde anti-abus : seul le robot BOAMP de CE projet peut être relayé.
  IF next_url NOT LIKE 'https://xfqvaeshidleazgfqlze.supabase.co/functions/v1/fetch-boamp%' THEN
    RAISE EXCEPTION 'relay_fetch_boamp: URL non autorisée';
  END IF;
  RETURN net.http_post(
    url := next_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 120000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.relay_fetch_boamp(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.relay_fetch_boamp(text) TO service_role;
