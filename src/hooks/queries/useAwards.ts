import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AwardWithTender = {
  id: string;
  winner_name: string | null;
  winner_siren: string | null;
  awarded_amount: number | null;
  num_candidates: number | null;
  award_date: string | null;
  contract_duration: string | null;
  tender_id: string | null;
  tenders: { title: string; buyer_name: string | null } | null;
};

export function useAwards(limit = 100) {
  return useQuery({
    queryKey: ["awards", { limit }],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("award_notices")
        .select("*, tenders(title, buyer_name)")
        .order("award_date", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as AwardWithTender[];
    },
  });
}
