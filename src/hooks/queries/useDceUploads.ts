import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DceFile {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  created_at: string;
}

export function useDceUploadedTenderIds(userId: string | undefined) {
  return useQuery({
    queryKey: ["dce-uploaded-tender-ids", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dce_uploads")
        .select("tender_id, agent_run_id")
        .eq("user_id", userId!);
      if (error) throw error;
      const map = new Map<string, { viaAgent: boolean }>();
      for (const row of data ?? []) {
        const prev = map.get(row.tender_id);
        const viaAgent = !!row.agent_run_id || prev?.viaAgent || false;
        map.set(row.tender_id, { viaAgent });
      }
      return map;
    },
  });
}
