import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AwardWithTender = {
  id: string;
  source: string | null;
  reference: string | null;
  winner_name: string | null;
  winner_siren: string | null;
  winner_address: string | null;
  winner_legal_form: string | null;
  winner_country: string | null;
  awarded_amount: number | null;
  num_candidates: number | null;
  offers_received: number | null;
  offers_admitted: number | null;
  offers_rejected: number | null;
  subcontracting_share: number | null;
  award_date: string | null;
  notification_date: string | null;
  award_criteria: unknown;
  cpv_codes: string[] | null;
  place_of_performance: string | null;
  notice_url: string | null;
  source_url: string | null;
  contract_duration: string | null;
  lots_awarded: unknown;
  tender_id: string | null;
  tenders: { title: string; buyer_name: string | null } | null;
};

export type AwardsFilters = {
  search?: string;
  source?: "all" | "BOAMP" | "TED" | "legacy";
  minAmount?: number | null;
  sinceDays?: number | null;
};

const PAGE_SIZE = 50;

export function useAwardsInfinite(filters: AwardsFilters = {}) {
  return useInfiniteQuery({
    queryKey: ["awards-infinite", filters],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let q = supabase
        .from("award_notices")
        .select("*, tenders(title, buyer_name)", { count: "exact" })
        .order("award_date", { ascending: false, nullsFirst: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (filters.source && filters.source !== "all") {
        if (filters.source === "legacy") q = q.is("source", null);
        else q = q.eq("source", filters.source);
      }
      if (filters.minAmount != null) q = q.gte("awarded_amount", filters.minAmount);
      if (filters.sinceDays) {
        const since = new Date(Date.now() - filters.sinceDays * 86400000).toISOString().slice(0, 10);
        q = q.gte("award_date", since);
      }
      if (filters.search && filters.search.trim()) {
        const s = `%${filters.search.trim()}%`;
        q = q.or(`winner_name.ilike.${s},title.ilike.${s}`);
      }

      const { data, error, count } = await q;
      if (error) throw error;
      return {
        rows: (data ?? []) as AwardWithTender[],
        nextOffset: (data?.length ?? 0) === PAGE_SIZE ? pageParam + PAGE_SIZE : null,
        total: count ?? 0,
      };
    },
    getNextPageParam: (last) => last.nextOffset,
  });
}

// Legacy export kept for any other caller
export function useAwards(limit = 100) {
  return useInfiniteQuery({
    queryKey: ["awards", { limit }],
    initialPageParam: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("award_notices")
        .select("*, tenders(title, buyer_name)")
        .order("award_date", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return {
        rows: (data ?? []) as AwardWithTender[],
        nextOffset: null as number | null,
        total: data?.length ?? 0,
      };
    },
    getNextPageParam: () => null as number | null,
  });
}
