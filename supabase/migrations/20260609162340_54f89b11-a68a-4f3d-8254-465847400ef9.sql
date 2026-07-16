CREATE OR REPLACE FUNCTION public.rebuild_tender_groups()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE cnt int;
BEGIN
  DELETE FROM public.tender_groups;
  INSERT INTO public.tender_groups (tender_id, group_id)
  SELECT id, id FROM public.tenders;

  LOOP
    WITH neighbor_min AS (
      SELECT tender_id, (min(g::text))::uuid AS min_g
      FROM (
        SELECT tg.tender_id, tg.group_id AS g FROM public.tender_groups tg
        UNION ALL
        SELECT m.id_a, g2.group_id FROM public.v_tender_matches m
          JOIN public.tender_groups g2 ON g2.tender_id = m.id_b
        UNION ALL
        SELECT m.id_b, g1.group_id FROM public.v_tender_matches m
          JOIN public.tender_groups g1 ON g1.tender_id = m.id_a
      ) x GROUP BY tender_id
    )
    UPDATE public.tender_groups g
    SET group_id = nm.min_g, updated_at = now()
    FROM neighbor_min nm
    WHERE g.tender_id = nm.tender_id AND g.group_id <> nm.min_g;
    GET DIAGNOSTICS cnt = ROW_COUNT;
    EXIT WHEN cnt = 0;
  END LOOP;
END;
$function$;