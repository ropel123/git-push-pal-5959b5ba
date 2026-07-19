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
      const tendersRes = await supabase
        .from("tenders")
        .select("id, title, status, estimated_amount, publication_date, deadline, region")
        .eq("buyer_name", buyerName!)
        .order("publication_date", { ascending: false });
      if (tendersRes.error) throw tendersRes.error;
      const tenders = (tendersRes.data ?? []) as BuyerTender[];
      const tenderIds = tenders.map((t) => t.id);

      // Filtrage côté serveur : sans filtre, `award_notices` est plafonné à 1000
      // lignes par PostgREST puis filtré côté client — on ratait des attributions.
      // On requête par lots d'ids pour garder l'URL sous une taille raisonnable.
      const awards: BuyerAward[] = [];
      if (tenderIds.length > 0) {
        const CHUNK = 200;
        for (let i = 0; i < tenderIds.length; i += CHUNK) {
          const ids = tenderIds.slice(i, i + CHUNK);
          const { data, error } = await supabase
            .from("award_notices")
            .select("id, winner_name, awarded_amount, award_date, tender_id")
            .in("tender_id", ids);
          if (error) throw error;
          awards.push(...((data ?? []) as BuyerAward[]));
        }
      }
      return { tenders, awards };
    },
  });
}
