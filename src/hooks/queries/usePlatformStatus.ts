import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PlatformStatus = {
  platform: string;
  total: number;
  ok: number;
  errors: number;
  lastRun: string | null;
  worstStatus: "success" | "stale" | "error";
};

const STALE_MS = 48 * 60 * 60 * 1000;

export function usePlatformStatus() {
  return useQuery({
    queryKey: ["platform-status"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sourcing_urls")
        .select("platform, last_status, last_run_at, is_active")
        .eq("is_active", true);
      if (error) throw error;
      const byPlatform = new Map<string, PlatformStatus>();
      const now = Date.now();
      for (const row of data ?? []) {
        const key = row.platform ?? "unknown";
        const cur = byPlatform.get(key) ?? {
          platform: key,
          total: 0,
          ok: 0,
          errors: 0,
          lastRun: null,
          worstStatus: "success" as const,
        };
        cur.total += 1;
        if (row.last_status === "success") cur.ok += 1;
        if (row.last_status === "error") cur.errors += 1;
        if (row.last_run_at && (!cur.lastRun || row.last_run_at > cur.lastRun)) {
          cur.lastRun = row.last_run_at;
        }
        byPlatform.set(key, cur);
      }
      // Compute worstStatus
      for (const p of byPlatform.values()) {
        if (p.errors > 0 && p.ok === 0) p.worstStatus = "error";
        else if (!p.lastRun || now - new Date(p.lastRun).getTime() > STALE_MS) p.worstStatus = "stale";
        else p.worstStatus = "success";
      }
      return Array.from(byPlatform.values()).sort((a, b) => a.platform.localeCompare(b.platform));
    },
  });
}
