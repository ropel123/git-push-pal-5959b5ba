import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DceSourcingRow = {
  host: string;
  platform: string | null;
  category: string | null;
  fingerprint_source: "ai" | "hostname" | "other" | null;
  confidence: number | null;
  boamp_count: number;
  ted_count: number;
  total_count: number;
  sample_tender_id: string | null;
  sample_dce_url: string | null;
};

export function useDceSourcing(search: string, category: string) {
  return useQuery({
    queryKey: ["dce-sourcing", search, category],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_dce_sourcing_by_fingerprint" as never,
        { _search: search || null, _category: category || null } as never
      );
      if (error) throw error;
      return (data ?? []) as DceSourcingRow[];
    },
  });
}

export function useClassifyHost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { host: string; sample_url: string }) => {
      const { data, error } = await supabase.functions.invoke("classify-host", {
        body: input,
      });
      if (error) throw error;
      return data as { platform: string; confidence: number; evidence: string[] };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dce-sourcing"] });
    },
  });
}
