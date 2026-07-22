-- Recherche plein-texte française sur les AO, insensible aux accents.
-- L'ancienne recherche (ILIKE sur la phrase entière) exigeait que la saisie
-- apparaisse telle quelle dans le titre : « travaux ecole » → 2 résultats,
-- là où le plein-texte en trouve 293 (« Travaux de l'école », pluriels,
-- accents). Syntaxe websearch côté client : multi-mots = ET, "guillemets"
-- = expression exacte, OR, -exclusion.
-- (Exécutée en production le 2026-07-22.)

CREATE EXTENSION IF NOT EXISTS unaccent;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'fr_unaccent') THEN
    CREATE TEXT SEARCH CONFIGURATION public.fr_unaccent (COPY = french);
    ALTER TEXT SEARCH CONFIGURATION public.fr_unaccent
      ALTER MAPPING FOR hword, hword_part, word WITH unaccent, french_stem;
  END IF;
END $do$;

ALTER TABLE public.tenders ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('public.fr_unaccent',
      coalesce(title, '') || ' ' || coalesce(object, '') || ' ' ||
      coalesce(description, '') || ' ' || coalesce(buyer_name, '') || ' ' ||
      coalesce(reference, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS tenders_search_vector_idx ON public.tenders USING gin (search_vector);
