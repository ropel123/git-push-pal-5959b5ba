import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Liste des appels d'offres avec filtres optionnels.
 *  Premier hook de la migration vers TanStack Query (chantier 4). */
export type TendersFilters = {
  status?: "open" | "closed" | "awarded";
  region?: string;
  search?: string;
  limit?: number;
};

export function useTenders(filters: TendersFilters = {}) {
  return useQuery({
    queryKey: ["tenders", filters],
    queryFn: async () => {
      let query = supabase
        .from("tenders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(filters.limit ?? 200);
      if (filters.status) query = query.eq("status", filters.status);
      if (filters.region) query = query.eq("region", filters.region);
      if (filters.search) query = query.ilike("title", `%${filters.search}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTender(id: string | undefined) {
  return useQuery({
    queryKey: ["tender", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("tenders").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
