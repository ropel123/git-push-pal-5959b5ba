import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BuyerTender = {
  id: string;
  title: string;
  status: string | null;
  estimated_amount: number | null;
  publication_date: string | null;
  deadline: string | null;
  region: string | null;
};

export type BuyerAward = {
  id: string;
  winner_name: string | null;
  awarded_amount: number | null;
  award_date: string | null;
  tender_id: string | null;
};

export function useBuyerData(buyerName: string | undefined) {
  return useQuery({
    queryKey: ["buyer", buyerName],
    enabled: !!buyerName,
    queryFn: async () => {
      const [tendersRes, awardsRes] = await Promise.all([
        supabase
          .from("tenders")
          .select("id, title, status, estimated_amount, publication_date, deadline, region")
          .eq("buyer_name", buyerName!)
          .order("publication_date", { ascending: false }),
        supabase.from("award_notices").select("id, winner_name, awarded_amount, award_date, tender_id"),
      ]);
      if (tendersRes.error) throw tendersRes.error;
      if (awardsRes.error) throw awardsRes.error;
      const tenders = (tendersRes.data ?? []) as BuyerTender[];
      const tenderIds = new Set(tenders.map((t) => t.id));
      const awards = ((awardsRes.data ?? []) as BuyerAward[]).filter(
        (a) => a.tender_id && tenderIds.has(a.tender_id),
      );
      return { tenders, awards };
    },
  });
}
