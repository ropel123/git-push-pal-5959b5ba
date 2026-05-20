import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DceFile } from "@/hooks/queries/useDceUploads";

export function useUploadDce(tenderId: string, userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      if (!userId) throw new Error("Non authentifié");
      const filePath = `${userId}/${tenderId}/${Date.now()}_${file.name}`;
      const { error: storageError } = await supabase.storage
        .from("dce-documents")
        .upload(filePath, file);
      if (storageError) throw storageError;
      const { error: dbError } = await supabase.from("dce_uploads").insert({
        tender_id: tenderId,
        user_id: userId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
      });
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dce-uploads", tenderId, userId] });
    },
  });
}

export function useDeleteDce(tenderId: string, userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (upload: DceFile) => {
      await supabase.storage.from("dce-documents").remove([upload.file_path]);
      const { error } = await supabase.from("dce_uploads").delete().eq("id", upload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dce-uploads", tenderId, userId] });
    },
  });
}
