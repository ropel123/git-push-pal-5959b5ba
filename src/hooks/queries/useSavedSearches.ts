import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SavedSearch = { id: string; name: string; filters: Record<string, unknown> };

export function useSavedSearches(userId: string | undefined, limit?: number) {
  return useQuery({
    queryKey: ["saved-searches", userId, limit ?? null],
    enabled: !!userId,
    queryFn: async () => {
      let q = supabase
        .from("saved_searches")
        .select("id, name, filters")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SavedSearch[];
    },
  });
}

export function useCreateSavedSearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { user_id: string; name: string; filters: Record<string, unknown> }) => {
      const { error } = await supabase.from("saved_searches").insert([input]);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-searches"] }),
  });
}

export function useDeleteSavedSearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saved_searches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-searches"] }),
  });
}
