UPDATE public.agent_playbooks
SET url_pattern = 'marches-publics\.info|marchespublics\.[a-z0-9-]+\.(fr|com)',
    list_strategy = COALESCE(list_strategy, 'hybrid')
WHERE platform = 'mpi';