-- Repêchage des liens profonds de consultation perdus à l'ingestion.
-- Contexte : le parseur BOAMP prenait le premier candidat d'URL (souvent la
-- racine « profil d'acheteur ») et jetait le lien exact de la consultation
-- quand l'avis le contenait. Le parseur est corrigé (priorité au lien
-- profond) ; cette migration récupère les liens déjà perdus depuis le payload
-- brut stocké (enriched_data). Idempotente : ne touche pas les dce_url déjà
-- profonds.

UPDATE public.tenders t
SET dce_url = rtrim(sub.deep, '.,;)»')
FROM (
  SELECT id,
    substring(enriched_data::text from
      '(?i)(https?://[^"\s\\]*(maximilien|achatpublic|marches-securises|marches-publics|e-marchespublics|megalis|atline|klekoon|dematis|local-trust|aws-achat|centraledesmarches|safetender|ternum|xmarches|synapse-entreprises|marchesonline|eu-supply|adullact|demat|atexo|bravosolution|ivalua|aji-france|medialex)[^"\s\\]{0,150}(fichecsl|consultation|detail|aoo[_-]|[?&][^"\s\\&=]{0,40}(id|ref|cons|code)[^"\s\\&=]{0,40}=|/[0-9]{5,})[^"\s\\]{0,100})'
    ) AS deep
  FROM public.tenders
  WHERE dce_url IS NULL
     OR dce_url !~* '(fichecsl|consultation|detail|aoo[_-]|[?&][^"\s&=]{0,40}(id|ref|cons|code)[^"\s&=]{0,40}=|/[0-9]{5,})'
) sub
WHERE t.id = sub.id
  AND sub.deep IS NOT NULL
  AND sub.deep IS DISTINCT FROM t.dce_url;
