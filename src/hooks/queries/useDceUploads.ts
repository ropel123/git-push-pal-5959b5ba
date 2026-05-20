import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DceFile {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  created_at: string;
}

export function useDceUploads(tenderId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ["dce-uploads", tenderId, userId],
    enabled: !!tenderId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dce_uploads")
        .select("id, file_name, file_path, file_size, created_at")
        .eq("tender_id", tenderId!)
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DceFile[];
    },
  });
}
