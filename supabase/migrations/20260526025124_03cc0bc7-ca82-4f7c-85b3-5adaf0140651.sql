create or replace function public.get_distinct_tender_sources()
returns table(source text)
language sql stable security definer set search_path = public as $$
  select distinct t.source from public.tenders t
  where t.source is not null
  order by 1;
$$;

create or replace function public.get_distinct_tender_procedures()
returns table(procedure_type text)
language sql stable security definer set search_path = public as $$
  select distinct t.procedure_type from public.tenders t
  where t.procedure_type is not null
  order by 1;
$$;

grant execute on function public.get_distinct_tender_sources() to anon, authenticated;
grant execute on function public.get_distinct_tender_procedures() to anon, authenticated;