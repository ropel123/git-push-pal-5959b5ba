import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Hooks TanStack Query pour la lecture des appels d'offres (chantier 4). */

export type TenderStatus = "open" | "closed" | "awarded" | "cancelled";

export type SmartProfile = {
  regions?: string[] | null;
  keywords?: string[] | null;
} | null;

export type TendersFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  region?: string;
  status?: TenderStatus;
  procedure?: string;
  platform?: string;
  listingHost?: string;
  dceOnly?: boolean;
  /** Restrict results to this set of tender IDs (server-side `.in('id', ...)`). When provided as empty array, returns no rows. */
  idsIn?: string[] | null;
  smart?: SmartProfile;
  /** Désactive temporairement la query (ex: profil pas encore chargé). */
  enabled?: boolean;
};

export function useTenders(filters: TendersFilters = {}) {
  const {
    page = 0,
    pageSize = 20,
    search = "",
    region = "",
    status = "",
    procedure = "",
    platform = "",
    listingHost = "",
    dceOnly = false,
    idsIn = null,
    smart = null,
    enabled = true,
  } = filters;

  return useQuery({
    enabled,
    placeholderData: keepPreviousData,
    queryKey: ["tenders", { page, pageSize, search, region, status, procedure, platform, listingHost, dceOnly, idsIn, smart }],
    queryFn: async () => {
      // Short-circuit: caller requested filtering by an empty ID set.
      if (idsIn && idsIn.length === 0) {
        return { items: [], count: 0 };
      }

      const from = page * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("tenders")
        .select("*", { count: "exact" })
        .order("publication_date", { ascending: false })
        .range(from, to);

      if (idsIn && idsIn.length > 0) query = query.in("id", idsIn);

      if (smart) {
        const regions = smart.regions ?? [];
        const keywords = smart.keywords ?? [];
        if (regions.length > 0) query = query.in("region", regions);
        if (keywords.length > 0) {
          const orClauses = keywords.flatMap((kw) => [
            `title.ilike.%${kw}%`,
            `object.ilike.%${kw}%`,
          ]);
          query = query.or(orClauses.join(","));
        }
      }

      if (dceOnly) query = query.not("dce_url", "is", null).neq("dce_url", "");

      const term = search.trim();
      if (term) {
        query = query.or(
          `title.ilike.%${term}%,buyer_name.ilike.%${term}%,object.ilike.%${term}%`,
        );
      }
      if (region && region !== "all") query = query.eq("region", region);
      if (status && status !== ("all" as TenderStatus)) {
        query = query.eq("status", status as TenderStatus);
      }
      if (procedure && procedure !== "all") query = query.eq("procedure_type", procedure);
      if (platform && platform !== "all") query = query.eq("source", platform);
      if (listingHost && listingHost !== "all") {
        query = query.ilike("enriched_data->raw->>_source_url", `%${listingHost}%`);
      }

      const { data, count, error } = await query;
      if (error) throw error;
      return { items: data ?? [], count: count ?? 0 };
    },
  });
}

export function useTender(id: string | undefined) {
  return useQuery({
    queryKey: ["tender", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenders")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useTenderAwards(tenderId: string | undefined) {
  return useQuery({
    queryKey: ["tender-awards", tenderId],
    enabled: !!tenderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("award_notices")
        .select("*")
        .eq("tender_id", tenderId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}
