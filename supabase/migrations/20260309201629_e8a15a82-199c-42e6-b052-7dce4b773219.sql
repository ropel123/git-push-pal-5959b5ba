
-- Drop the partial unique index  
DROP INDEX IF EXISTS idx_tenders_reference_source;

-- Create a proper unique constraint (not partial) for upsert compatibility
-- First handle any existing NULL values by setting defaults
UPDATE public.tenders SET reference = id::text WHERE reference IS NULL;
UPDATE public.tenders SET source = 'manual' WHERE source IS NULL;

-- Make columns NOT NULL with defaults for future inserts
ALTER TABLE public.tenders ALTER COLUMN reference SET DEFAULT '';
ALTER TABLE public.tenders ALTER COLUMN source SET DEFAULT 'manual';

-- Create unique constraint
ALTER TABLE public.tenders ADD CONSTRAINT tenders_reference_source_unique UNIQUE (reference, source);
