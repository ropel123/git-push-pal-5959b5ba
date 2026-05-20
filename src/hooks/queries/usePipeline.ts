import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Stage = "spotted" | "analyzing" | "no_go" | "responding" | "won" | "lost";

export interface PipelineItem {
  id: string;
  stage: Stage;
  score: number | null;
  notes: string | null;
  tender_id: string;
  tenders: {
    title: string;
    buyer_name: string | null;
    estimated_amount: number | null;
    deadline: string | null;
  } | null;
}

export interface PipelineComment {
  id: string;
  content: string;
  created_at: string | null;
}

export function usePipelineItems(userId: string | undefined) {
  return useQuery({
    queryKey: ["pipeline-items", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_items")
        .select("*, tenders(title, buyer_name, estimated_amount, deadline)")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PipelineItem[];
    },
  });
}

export function usePipelineComments(itemId: string | null) {
  return useQuery({
    queryKey: ["pipeline-comments", itemId],
    enabled: !!itemId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_comments")
        .select("id, content, created_at")
        .eq("pipeline_item_id", itemId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PipelineComment[];
    },
  });
}

export function useUpdatePipelineStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, stage }: { itemId: string; stage: Stage }) => {
      const { error } = await supabase.from("pipeline_items").update({ stage }).eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline-items"] });
      qc.invalidateQueries({ queryKey: ["pipeline-distribution"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useRemovePipelineItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("pipeline_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline-items"] });
      qc.invalidateQueries({ queryKey: ["pipeline-distribution"] });
      qc.invalidateQueries({ queryKey: ["recent-pipeline"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useAddPipelineComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { pipeline_item_id: string; user_id: string; content: string }) => {
      const { data, error } = await supabase
        .from("pipeline_comments")
        .insert([input])
        .select("id, content, created_at")
        .single();
      if (error) throw error;
      return data as PipelineComment;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["pipeline-comments", vars.pipeline_item_id] });
    },
  });
}
