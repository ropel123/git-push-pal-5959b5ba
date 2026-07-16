DROP POLICY IF EXISTS "Users can view own DCE files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own DCE files" ON storage.objects;

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