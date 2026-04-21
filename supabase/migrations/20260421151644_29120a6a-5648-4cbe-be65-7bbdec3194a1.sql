INSERT INTO public.sourcing_urls (url, display_name, platform, frequency_hours, is_active, parser_type) VALUES
('https://marches.maximilien.fr/?page=entreprise.EntrepriseAdvancedSearch&AllCons', 'Maximilien (Île-de-France)', 'atexo', 6, true, 'auto'),
('https://projets-achats.marches-publics.gouv.fr/', 'APProch — Préavis (État)', 'place', 12, true, 'auto'),
('https://marches.ternum-bfc.fr/?page=entreprise.EntrepriseAdvancedSearch&AllCons', 'Ternum (Bourgogne-Franche-Comté)', 'atexo', 6, true, 'auto'),
('https://marchespublics.grandest.fr/avis/index.cfm?fuseaction=pub.affResultats', 'Région Grand Est', 'mpi', 6, true, 'auto'),
('https://plateforme.alsacemarchespublics.eu/?page=Entreprise.EntrepriseAdvancedSearch&searchAnnCons&keyWord=&categorie=0&localisations=', 'Alsace Marchés Publics', 'atexo', 6, true, 'auto'),
('https://marchespublics.ampmetropole.fr/?page=Entreprise.EntrepriseAdvancedSearch&AllCons', 'Aix-Marseille Provence Métropole', 'atexo', 6, true, 'auto'),
('https://marchespublics.nantesmetropole.fr/?page=Entreprise.EntrepriseAdvancedSearch&AllCons', 'Nantes Métropole', 'atexo', 6, true, 'auto'),
('https://marchespublics.auvergnerhonealpes.eu/sdm/ent2/gen/rechercheCsl.action?tp=1776784247743', 'Région Auvergne-Rhône-Alpes', 'safetender', 6, true, 'auto'),
('https://marchespublics.paysdelaloire.fr/?page=Entreprise.EntrepriseAdvancedSearch&AllCons', 'Région Pays de la Loire', 'atexo', 6, true, 'auto'),
('https://haute-garonne.marches-publics.info/avis/index.cfm?fuseaction=pub.affResultats&IDs=4150', 'Haute-Garonne', 'mpi', 6, true, 'auto')
ON CONFLICT DO NOTHING;