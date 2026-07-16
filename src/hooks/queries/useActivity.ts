import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STAGE_LABELS: Record<string, string> = {
  spotted: "Repéré", analyzing: "En analyse", no_go: "No Go",
  responding: "En réponse", won: "Gagné", lost: "Perdu",
};

export interface ActivityEntry {
  id: string;
  type: "pipeline" | "comment";
  date: string;
  title: string;
  detail: string;
}

export function useActivityFeed(userId: string | undefined) {
  return useQuery({
    queryKey: ["activity-feed", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [pipelineRes, commentsRes] = await Promise.all([
        supabase
          .from("pipeline_items")
          .select("id, stage, created_at, updated_at, tender_id, tenders(title)")
          .eq("user_id", userId!)
          .order("updated_at", { ascending: false })
          .limit(30),
        supabase
          .from("pipeline_comments")
          .select("id, content, created_at, pipeline_item_id, pipeline_items(tender_id, tenders(title))")
          .eq("user_id", userId!)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      if (pipelineRes.error) throw pipelineRes.error;
      if (commentsRes.error) throw commentsRes.error;

      const items: ActivityEntry[] = [];
      for (const p of pipelineRes.data ?? []) {
        const t = p.tenders as any;
        items.push({
          id: `p-${p.id}`,
          type: "pipeline",
          date: p.updated_at ?? p.created_at ?? "",
          title: t?.title ?? "AO supprimé",
          detail: `Étape : ${STAGE_LABELS[p.stage ?? "spotted"] ?? p.stage}`,
        });
      }
      for (const c of commentsRes.data ?? []) {
        const pi = c.pipeline_items as any;
        items.push({
          id: `c-${c.id}`,
          type: "comment",
          date: c.created_at ?? "",
          title: pi?.tenders?.title ?? "AO supprimé",
          detail: c.content.length > 80 ? c.content.slice(0, 80) + "…" : c.content,
        });
      }
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return items;
    },
  });
}
