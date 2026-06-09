import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useSubscription() {
  const { user } = useAuth();
  return useQuery({
    enabled: !!user,
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      const active = (data ?? []).filter((s) =>
        ["active", "trialing", "past_due"].includes(s.status),
      );
      return { all: data ?? [], active };
    },
  });
}
