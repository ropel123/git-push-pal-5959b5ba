import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ReclassifyJob = {
  id: string;
  status: "running" | "done" | "failed";
  total: number;
  processed: number;
  classified: number;
  errors: Array<{ host: string; error: string }>;
  started_at: string;
  finished_at: string | null;
};

export function useReclassifyJob() {
  return useQuery({
    queryKey: ["reclassify-job-latest"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reclassify_jobs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as ReclassifyJob | null) ?? null;
    },
    refetchInterval: (q) => {
      const job = q.state.data as ReclassifyJob | null;
      return job?.status === "running" ? 3000 : false;
    },
  });
}

export function useStartReclassify() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("reclassify-all-hosts", {
        body: {},
      });
      if (error) throw error;
      return data as { job_id: string; total: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reclassify-job-latest"] });
      qc.invalidateQueries({ queryKey: ["dce-sourcing"] });
    },
  });
}
