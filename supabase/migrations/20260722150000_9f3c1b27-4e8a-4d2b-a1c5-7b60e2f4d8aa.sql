-- Nettoyage des entités HTML littérales laissées par le pipeline XML→JSON de
-- BOAMP. Mesuré par audit : 1 603 dce_url (23 % des renseignées) contenaient
-- « &amp; » au lieu de « & » — au clic, le paramètre devenait « amp;type= » et
-- la plateforme ne trouvait pas la consultation. Aussi : 56 submission_url,
-- 5 buyer_contact->url, 3 titres, 124 descriptions, 18 emails invalides.
-- Le parseur est corrigé (decodeHtmlEntities dans boampParse.ts) ; cette
-- migration répare le stock existant. Idempotente.
-- (Exécutée directement en production le 2026-07-22.)

-- URLs cassées au clic
UPDATE public.tenders SET dce_url = replace(replace(dce_url, '&amp;amp;', '&'), '&amp;', '&')
WHERE dce_url LIKE '%&amp;%';
UPDATE public.tenders SET submission_url = replace(replace(submission_url, '&amp;amp;', '&'), '&amp;', '&')
WHERE submission_url LIKE '%&amp;%';
UPDATE public.tenders SET buyer_contact = jsonb_set(buyer_contact, '{url}',
  to_jsonb(replace(replace(buyer_contact->>'url', '&amp;amp;', '&'), '&amp;', '&')))
WHERE buyer_contact->>'url' LIKE '%&amp;%';

-- Titres et descriptions pollués
UPDATE public.tenders SET
  title = replace(replace(replace(replace(replace(replace(title,'&amp;amp;','&'),'&amp;','&'),'&lt;','<'),'&gt;','>'),'&quot;','"'),'&#39;',''''),
  description = replace(replace(replace(replace(replace(replace(description,'&amp;amp;','&'),'&amp;','&'),'&lt;','<'),'&gt;','>'),'&quot;','"'),'&#39;','''')
WHERE title ~ '&(amp|lt|gt|quot|#39);' OR description ~ '&(amp|lt|gt|quot|#39);';

-- Emails invalides : on retire la clé plutôt que d'afficher un email faux
UPDATE public.tenders SET buyer_contact = buyer_contact - 'email'
WHERE buyer_contact->>'email' IS NOT NULL AND btrim(buyer_contact->>'email') <> ''
  AND buyer_contact->>'email' !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$';
