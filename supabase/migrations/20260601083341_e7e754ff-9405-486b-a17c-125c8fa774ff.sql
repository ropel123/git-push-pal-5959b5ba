-- Tighten MPI regex: only real MPI hosts (marches-publics.info family + Grand Est)
UPDATE public.agent_playbooks
SET url_pattern = '(^|//)([a-z0-9-]+\.)?marches-publics\.info(/|$|\?)|(^|//)marchespublics\.grandest\.fr(/|$|\?)'
WHERE platform = 'mpi';

-- Broaden Atexo regex to cover ADM76 + generic marchespublics.* SPL hosts (Atexo SDM)
UPDATE public.agent_playbooks
SET url_pattern = 'profilacheteur\.|atexo|(^|//)marchespublics\.adm76\.com|(^|//)marchespublics\.[a-z0-9-]+\.(fr|com|eu)(?<!marchespublics\.grandest\.fr)'
WHERE platform = 'atexo_spl';