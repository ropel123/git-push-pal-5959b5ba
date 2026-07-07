import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";

/** Hooks dashboard (chantier 4). Toutes les queries sont cachées 60s par défaut (cf. App.tsx). */

export function useDashboardStats(userId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard-stats", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [t, p, w, o] = await Promise.all([
        supabase.from("tenders").select("id", { count: "exact", head: true }),
        supabase.from("pipeline_items").select("id", { count: "exact", head: true }).eq("user_id", userId!),
        supabase.from("pipeline_items").select("id", { count: "exact", head: true }).eq("user_id", userId!).eq("stage", "won"),
        supabase.from("tenders").select("id", { count: "exact", head: true }).eq("status", "open")
          .or(`deadline.is.null,deadline.gte.${new Date().toISOString()}`),
      ]);
      return {
        totalTenders: t.count ?? 0,
        pipelineItems: p.count ?? 0,
        wonItems: w.count ?? 0,
        openTenders: o.count ?? 0,
      };
    },
  });
}

export function useTendersMonthly() {
  return useQuery({
    queryKey: ["tenders-monthly"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenders")
        .select("publication_date")
        .not("publication_date", "is", null);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((t) => {
        const m = format(new Date(t.publication_date!), "yyyy-MM");
        counts[m] = (counts[m] ?? 0) + 1;
      });
      return Object.entries(counts)
        .sort()
        .slice(-6)
        .map(([m, c]) => ({ month: format(new Date(m + "-01"), "MMM yy", { locale: fr }), count: c }));
    },
  });
}

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

export function useUrgentTenders() {
  return useQuery({
    queryKey: ["urgent-tenders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenders")
        .select("id, title, deadline")
        .eq("status", "open")
        .not("deadline", "is", null);
      if (error) throw error;
      const now = new Date();
      return (data ?? [])
        .filter((t) => {
          const days = differenceInDays(new Date(t.deadline!), now);
          return days >= 0 && days <= 7;
        })
        .slice(0, 5);
    },
  });
}
