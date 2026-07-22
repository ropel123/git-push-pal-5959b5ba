-- Nettoyage : ~16 % des fiches affichaient les coordonnées de l'OPÉRATEUR de
-- publication (ex. AWS France, Seyssinet-Pariset) comme « contact acheteur »,
-- avec l'adresse et le NUTS correspondants. Le parseur est corrigé (extraction
-- scopée sur l'organisation acheteuse) ; cette migration retire les valeurs
-- contaminées — une donnée absente vaut mieux qu'une donnée fausse. Le payload
-- brut (enriched_data) est conservé : un re-parse pourra les re-remplir.

UPDATE public.tenders
SET buyer_contact = NULL,
    buyer_address = CASE WHEN buyer_address ~* 'seyssinet' THEN NULL ELSE buyer_address END,
    nuts_code = NULL
WHERE buyer_contact->>'email' ~* '(aws-france|avenue\s?web|atexo|dematis|klekoon|achatpublic|e-marchespublics|marches-securises|maximilien|local-?trust|megalis|centraledesmarches)'
   OR buyer_contact->>'ville' ~* 'seyssinet'
   OR buyer_address ~* 'seyssinet';
