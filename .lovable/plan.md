## Cause

L'erreur `Object not found` (HTTP 400/404) sur `dce-documents/{tender_id}/agent_*.zip` est en réalité un **refus RLS déguisé en 404** par Supabase Storage.

La politique RLS actuelle sur `storage.objects` pour `dce-documents` est :

```
(storage.foldername(name))[1] = auth.uid()::text
```

Donc elle attend un chemin `{user_id}/...`. Or l'agent (`fetch-dce-agent`) enregistre les ZIPs sous `{tender_id}/agent_*.zip`. Conséquence : l'upload réussit (service role bypass RLS), mais aucun utilisateur ne peut générer une signed URL → 404.

Les deux ZIPs `DCE_agent_maximilien.zip` existent bien dans le bucket et dans `dce_uploads` (vérifié en base).

## Correctif

Migration RLS : autoriser le SELECT (et DELETE) sur `dce-documents` si l'utilisateur possède un enregistrement correspondant dans `dce_uploads`.

```sql
DROP POLICY "Users can view own DCE files" ON storage.objects;
DROP POLICY "Users can delete own DCE files" ON storage.objects;

CREATE POLICY "Users can view own DCE files" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'dce-documents' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.dce_uploads
      WHERE dce_uploads.file_path = storage.objects.name
        AND dce_uploads.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can delete own DCE files" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'dce-documents' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.dce_uploads
      WHERE dce_uploads.file_path = storage.objects.name
        AND dce_uploads.user_id = auth.uid()
    )
  )
);
```

Cela couvre :
- les uploads manuels (chemin `{user_id}/...`)
- les ZIPs produits par l'agent (chemin `{tender_id}/agent_*.zip`) tant qu'il y a une ligne `dce_uploads` rattachant le fichier à l'user.

## Bonus UI (optionnel, à valider)

Le tender affiche deux fois le même ZIP (deux runs successifs ont chacun produit un fichier). Pour éviter ça :
- soit on déduplique côté UI sur `file_name + file_size`,
- soit on garde seulement le dernier `agent_run_id` par tender.

Pas inclus dans ce plan tant que tu ne le demandes pas.