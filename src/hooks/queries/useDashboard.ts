import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Hooks dashboard (chantier 4). Toutes les queries sont cachées 60s par défaut (cf. App.tsx). */

export function usePipelineDistribution(userId: string | undefined) {
  return useQuery({
    queryKey: ["pipeline-distribution", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("pipeline_items").select("stage").eq("user_id", userId!);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((i) => {
        const s = i.stage ?? "spotted";
        counts[s] = (counts[s] ?? 0) + 1;
      });
      return counts;
    },
  });
}

export function useRecentPipeline(userId: string | undefined) {
  return useQuery({
    queryKey: ["recent-pipeline", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_items")
        .select("*, tenders(title, deadline)")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });
}
