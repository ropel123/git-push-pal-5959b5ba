
create or replace view public.v_tender_sources as
select
  t.id,
  t.reference,
  t.title,
  t.object,
  t.buyer_name,
  t.deadline,
  t.publication_date,
  t.source as raw_source,
  case
    when lower(coalesce(t.source,'')) = 'boamp' then 'BOAMP'
    when lower(coalesce(t.source,'')) = 'ted' then 'TED'
    when t.source ilike 'scrape:%' then 'Scraping'
    else coalesce(t.source, 'Inconnu')
  end as source_category,
  case
    when t.source ilike 'scrape:%' then split_part(t.source, ':', 2)
    else lower(coalesce(t.source,''))
  end as source_key,
  coalesce(
    nullif(t.reference, ''),
    md5(
      lower(coalesce(t.buyer_name,'')) || '|' ||
      lower(left(coalesce(t.object, t.title, ''), 200)) || '|' ||
      coalesce(t.deadline::date::text, '')
    )
  ) as dedup_key
from public.tenders t;

grant select on public.v_tender_sources to authenticated, service_role;

create or replace function public.get_sourcing_kpis()
returns jsonb language sql stable security definer set search_path = public as $$
  with grouped as (
    select dedup_key,
      bool_or(source_category = 'BOAMP') as has_boamp,
      bool_or(source_category = 'Scraping') as has_scrape,
      bool_or(source_category = 'TED') as has_ted,
      count(distinct source_category) as n_cat
    from public.v_tender_sources group by dedup_key
  )
  select jsonb_build_object(
    'total_tenders', (select count(*) from public.tenders),
    'total_unique', (select count(*) from grouped),
    'boamp_only', (select count(*) from grouped where has_boamp and not has_scrape and not has_ted),
    'scrape_only', (select count(*) from grouped where has_scrape and not has_boamp and not has_ted),
    'ted_only', (select count(*) from grouped where has_ted and not has_boamp and not has_scrape),
    'boamp_and_scrape', (select count(*) from grouped where has_boamp and has_scrape),
    'multi_3plus', (select count(*) from grouped where n_cat >= 3),
    'with_boamp', (select count(*) from grouped where has_boamp),
    'with_scrape', (select count(*) from grouped where has_scrape),
    'with_ted', (select count(*) from grouped where has_ted)
  );
$$;
grant execute on function public.get_sourcing_kpis() to authenticated;

create or replace function public.get_sourcing_coverage(
  _filter text default 'all', _limit int default 50, _offset int default 0, _search text default null
)
returns table(dedup_key text, title text, buyer_name text, deadline timestamptz, reference text, sources text[], source_keys text[], ids uuid[])
language sql stable security definer set search_path = public as $$
  with grouped as (
    select v.dedup_key,
      (array_agg(v.title order by v.publication_date desc nulls last))[1] as title,
      (array_agg(v.buyer_name order by v.publication_date desc nulls last))[1] as buyer_name,
      max(v.deadline) as deadline,
      (array_agg(v.reference order by (v.reference is null)))[1] as reference,
      array_agg(distinct v.source_category) as sources,
      array_agg(distinct v.source_key) as source_keys,
      array_agg(v.id) as ids,
      bool_or(v.source_category = 'BOAMP') as has_boamp,
      bool_or(v.source_category = 'Scraping') as has_scrape,
      bool_or(v.source_category = 'TED') as has_ted,
      count(distinct v.source_category) as n_cat
    from public.v_tender_sources v group by v.dedup_key
  )
  select g.dedup_key, g.title, g.buyer_name, g.deadline, g.reference, g.sources, g.source_keys, g.ids
  from grouped g
  where case _filter
    when 'boamp_only' then g.has_boamp and not g.has_scrape and not g.has_ted
    when 'scrape_only' then g.has_scrape and not g.has_boamp and not g.has_ted
    when 'boamp_and_scrape' then g.has_boamp and g.has_scrape
    when 'ted_only' then g.has_ted and not g.has_boamp and not g.has_scrape
    when 'multi_3plus' then g.n_cat >= 3
    else true
  end
  and (_search is null or _search = '' or g.title ilike '%'||_search||'%' or g.buyer_name ilike '%'||_search||'%' or g.reference ilike '%'||_search||'%')
  order by g.deadline desc nulls last
  limit greatest(_limit, 1) offset greatest(_offset, 0);
$$;
grant execute on function public.get_sourcing_coverage(text, int, int, text) to authenticated;

create or replace function public.get_sourcing_per_source()
returns table(source_key text, source_category text, total bigint, exclusives bigint, duplicates bigint)
language sql stable security definer set search_path = public as $$
  with dedup_size as (
    select dedup_key, count(distinct source_key) as n_keys
    from public.v_tender_sources group by dedup_key
  )
  select v.source_key, v.source_category,
    count(distinct v.dedup_key) as total,
    count(distinct v.dedup_key) filter (where d.n_keys = 1) as exclusives,
    count(distinct v.dedup_key) filter (where d.n_keys > 1) as duplicates
  from public.v_tender_sources v
  join dedup_size d on d.dedup_key = v.dedup_key
  group by v.source_key, v.source_category
  order by total desc;
$$;
grant execute on function public.get_sourcing_per_source() to authenticated;
