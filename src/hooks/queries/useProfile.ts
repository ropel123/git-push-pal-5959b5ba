import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProfileRow {
  user_id: string;
  company_name: string | null;
  siren: string | null;
  sectors: string[] | null;
  regions: string[] | null;
  keywords: string[] | null;
  company_size: string | null;
  company_description: string | null;
  company_website: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  company_certifications: string[] | null;
  company_skills: string | null;
  company_team: string | null;
  company_equipment: string | null;
  company_past_work: string | null;
  company_logo_path: string | null;
  company_references: unknown;
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId!)
        .single();
      if (error) throw error;
      return data as unknown as ProfileRow;
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, patch }: { userId: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase
        .from("profiles")
        .update(patch as never)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}
