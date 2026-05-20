import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSaveMemoir(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updateData: Record<string, unknown>) => {
      if (!userId) throw new Error("Non authentifié");
      const { error } = await supabase
        .from("profiles")
        .update(updateData as never)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", userId] });
    },
  });
}
