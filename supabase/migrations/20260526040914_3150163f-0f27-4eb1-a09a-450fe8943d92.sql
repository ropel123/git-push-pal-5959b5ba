create table public.rescrape_jobs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null,
  scope jsonb not null default '{}'::jsonb,
  status text not null default 'running',
  total int not null default 0,
  done int not null default 0,
  found int not null default 0,
  inserted int not null default 0,
  updated int not null default 0,
  errors int not null default 0,
  last_url text,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rescrape_jobs enable row level security;

create policy "Admins manage rescrape_jobs"
on public.rescrape_jobs
for all
to authenticated
using (has_role(auth.uid(), 'admin'::app_role))
with check (has_role(auth.uid(), 'admin'::app_role));

create index idx_rescrape_jobs_created_by_status on public.rescrape_jobs(created_by, status, started_at desc);

create trigger update_rescrape_jobs_updated_at
before update on public.rescrape_jobs
for each row execute function public.update_updated_at_column();