import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SourcingKind = "tender" | "award";

export type SourcingUrl = {
  id: string;
  url: string;
  platform: string;
  display_name: string | null;
  frequency_hours: number;
  is_active: boolean;
  parser_type: string;
  kind: SourcingKind;
  last_run_at: string | null;
  last_status: string | null;
  last_items_found: number | null;
  last_items_inserted: number | null;
  last_error: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: any;
};

export type ScrapeLog = {
  id: string;
  source: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  items_found: number | null;
  items_inserted: number | null;
  items_updated: number | null;
  errors: string | null;
};

export function useSourcingUrls(enabled: boolean) {
  return useQuery({
    queryKey: ["sourcing-urls"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sourcing_urls")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SourcingUrl[];
    },
  });
}

export function useScrapeLogs(enabled: boolean) {
  return useQuery({
    queryKey: ["scrape-logs"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scrape_logs")
        .select("*")
        .or("source.like.scrape:%,source.like.scrape-awards:%")
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ScrapeLog[];
    },
  });
}
