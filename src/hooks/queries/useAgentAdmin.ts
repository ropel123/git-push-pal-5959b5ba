import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TraceEntry = {
  ts: string;
  step: string;
  status: "ok" | "skipped" | "failed";
  duration_ms?: number;
  detail?: string;
};

export type Run = {
  id: string;
  platform: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  cost_usd: number | null;
  captchas_solved: number | null;
  files_downloaded: number | null;
  error_message: string | null;
  tender_id: string | null;
  browserbase_session_id: string | null;
  trace: TraceEntry[] | null;
  dce_url: string;
};

export type Robot = {
  id: string;
  platform: string;
  login: string;
  password_encrypted: string;
  is_active: boolean;
  success_count: number;
  failure_count: number;
  last_used_at: string | null;
};

export type Playbook = {
  id: string;
  platform: string;
  display_name: string;
  url_pattern: string;
  requires_auth: boolean;
  requires_captcha: boolean;
  steps: unknown;
  is_active: boolean;
};

export type AnonIdentity = {
  id: string;
  email: string;
  company_name: string;
  siret: string | null;
  last_name: string;
  first_name: string;
  phone: string | null;
};

export function useAgentRuns(enabled: boolean) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel("agent_runs_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_runs" },
        () => qc.invalidateQueries({ queryKey: ["agent-runs"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, qc]);

  return useQuery({
    queryKey: ["agent-runs"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as Run[];
    },
  });
}

export function usePlatformRobots(enabled: boolean) {
  return useQuery({
    queryKey: ["platform-robots"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_robots")
        .select("*")
        .order("platform");
      if (error) throw error;
      return (data ?? []) as Robot[];
    },
  });
}

export function useAgentPlaybooks(enabled: boolean) {
  return useQuery({
    queryKey: ["agent-playbooks"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_playbooks")
        .select("*")
        .order("platform");
      if (error) throw error;
      return (data ?? []) as Playbook[];
    },
  });
}

export function useAnonIdentity(enabled: boolean) {
  return useQuery({
    queryKey: ["agent-anon-identity"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_anonymous_identity")
        .select("*")
        .eq("is_default", true)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        email: data.email ?? "",
        company_name: data.company_name ?? "",
        siret: data.siret ?? "",
        last_name: data.last_name ?? "",
        first_name: data.first_name ?? "",
        phone: data.phone ?? "",
      } as AnonIdentity;
    },
  });
}
