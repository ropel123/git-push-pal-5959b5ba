
DELETE FROM public.tenders
WHERE source = 'BOAMP'
  AND reference IN (SELECT reference FROM public.tenders WHERE source = 'boamp');

DELETE FROM public.tenders
WHERE source = 'TED'
  AND reference IN (SELECT reference FROM public.tenders WHERE source = 'ted');

DELETE FROM public.tenders
WHERE source = 'boamp'
  AND reference IN (SELECT reference FROM public.tenders WHERE source = 'BOAMP');

DELETE FROM public.tenders
WHERE source = 'ted'
  AND reference IN (SELECT reference FROM public.tenders WHERE source = 'TED');

UPDATE public.tenders SET source = 'BOAMP' WHERE source = 'boamp';
UPDATE public.tenders SET source = 'TED'   WHERE source = 'ted';
