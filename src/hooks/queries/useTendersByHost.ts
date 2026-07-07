import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TenderByHost = {
  id: string;
  title: string;
  buyer_name: string | null;
  deadline: string | null;
  publication_date: string | null;
  source: string | null;
  dce_url: string | null;
  reference: string | null;
};

export const useTendersByHost = (host: string | undefined) => {
  return useQuery({
    queryKey: ["tenders-by-host", host],
    enabled: !!host,
    queryFn: async (): Promise<TenderByHost[]> => {
      const pattern = `%${host}%`;
      const { data, error } = await supabase
        .from("tenders")
        .select("id,title,buyer_name,deadline,publication_date,source,dce_url,reference")
        .ilike("dce_url", pattern)
        .order("publication_date", { ascending: false, nullsFirst: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as TenderByHost[];
    },
  });
};
