import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  platformToCategory,
  fingerprintSourceFromEvidence,
} from "@/lib/sourcing";

export type HostFingerprint = {
  host: string;
  platform: string | null;
  category: string;
  fingerprint_source: string | null;
  confidence: number | null;
  last_seen_at: string | null;
  evidence: unknown;
};

export const useHostFingerprint = (host: string | undefined) => {
  return useQuery({
    queryKey: ["host-fingerprint", host],
    enabled: !!host,
    queryFn: async (): Promise<HostFingerprint | null> => {
      const { data, error } = await supabase
        .from("platform_fingerprints")
        .select("host,platform,confidence,evidence,detected_at")
        .eq("host", host!)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return {
          host: host!,
          platform: null,
          category: "inconnu",
          fingerprint_source: null,
          confidence: null,
          last_seen_at: null,
          evidence: null,
        };
      }
      return {
        host: data.host,
        platform: data.platform,
        category: platformToCategory(data.platform),
        fingerprint_source: fingerprintSourceFromEvidence(data.evidence),
        confidence: data.confidence as number | null,
        last_seen_at: data.detected_at as string | null,
        evidence: data.evidence,
      };
    },
  });
};
