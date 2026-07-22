-- Chef d'orchestre de la pagination BOAMP, côté base.
--
-- Contexte : le worker edge meurt en 546 WORKER_RESOURCE_LIMIT après ~18 s
-- de parse intensif (budget CPU par requête). Le découpage en petits lots
-- (#31) rend chaque invocation saine (~150 avis en ~5 s, 200 OK), mais le
-- « passage de relais » depuis le worker ne part jamais : le runtime tue
-- toute requête sortante à l'instant où la réponse est rendue — que ce soit
-- un fetch direct (#31) ou un rpc PostgREST (#32, vérifié en logs).
--
-- Postgres pilote donc la chaîne : un cron chaque minute lit l'état, relit
-- la réponse du maillon précédent (net._http_response), avance le curseur
-- et tire le maillon suivant via relay_fetch_boamp (pg_net). État persistant,
-- reprise sur échec (re-tir de la même page si réponse perdue > 3 min),
-- fin de chaîne quand la fonction renvoie nextPage=null.
--
-- Les crons quotidiens (3h15 fenêtre 30 j, 13h05 fenêtre 2 j) ne font plus
-- d'appel direct : ils SÈMENT une chaîne que le chef d'orchestre déroule
-- (~45 maillons pour 30 jours). Exécuté en production le 2026-07-22.

CREATE TABLE IF NOT EXISTS public.boamp_chain (
  id int PRIMARY KEY,
  base_url text NOT NULL,
  next_page int NOT NULL DEFAULT 0,
  last_req bigint,
  done boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.boamp_chain ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.drive_boamp_chain() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  c record;
  resp record;
  np int;
BEGIN
  SELECT * INTO c FROM public.boamp_chain WHERE NOT done ORDER BY id LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  IF c.last_req IS NOT NULL THEN
    SELECT status_code, content INTO resp FROM net._http_response WHERE id = c.last_req;
    IF NOT FOUND THEN
      -- Réponse pas encore arrivée : on attend, sauf si trop vieux (perdu).
      IF c.updated_at > now() - interval '3 minutes' THEN RETURN; END IF;
    ELSIF resp.status_code = 200 THEN
      np := nullif(resp.content::jsonb->>'nextPage', '')::int;
      IF np IS NULL THEN
        UPDATE public.boamp_chain SET done = true, last_req = NULL, updated_at = now() WHERE id = c.id;
        RETURN;
      END IF;
      UPDATE public.boamp_chain SET next_page = np, updated_at = now() WHERE id = c.id;
      c.next_page := np;
    END IF;
    -- non-200 : on re-tire la même page (erreur transitoire)
  END IF;

  UPDATE public.boamp_chain
  SET last_req = public.relay_fetch_boamp(c.base_url || '&start_page=' || c.next_page || '&hops=90'),
      updated_at = now()
  WHERE id = c.id;
END; $fn$;

-- Cron (prod) : SELECT cron.schedule('boamp-chain-driver', '* * * * *',
--   'SELECT public.drive_boamp_chain();');
-- Crons quotidiens (prod, jobs 6 et 13h05) : INSERT ... ON CONFLICT qui
-- réinitialise la chaîne id=1 avec la fenêtre voulue (30 j la nuit, 2 j à midi).
