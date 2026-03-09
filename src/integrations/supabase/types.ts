export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          filters: Json | null
          frequency: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          filters?: Json | null
          frequency?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          filters?: Json | null
          frequency?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      award_notices: {
        Row: {
          award_date: string | null
          awarded_amount: number | null
          contract_duration: string | null
          created_at: string | null
          id: string
          lots_awarded: Json | null
          num_candidates: number | null
          tender_id: string | null
          winner_name: string | null
          winner_siren: string | null
        }
        Insert: {
          award_date?: string | null
          awarded_amount?: number | null
          contract_duration?: string | null
          created_at?: string | null
          id?: string
          lots_awarded?: Json | null
          num_candidates?: number | null
          tender_id?: string | null
          winner_name?: string | null
          winner_siren?: string | null
        }
        Update: {
          award_date?: string | null
          awarded_amount?: number | null
          contract_duration?: string | null
          created_at?: string | null
          id?: string
          lots_awarded?: Json | null
          num_candidates?: number | null
          tender_id?: string | null
          winner_name?: string | null
          winner_siren?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "award_notices_tender_id_fkey"
            columns: ["tender_id"]
            isOneToOne: false
            referencedRelation: "tenders"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          pipeline_item_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          pipeline_item_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          pipeline_item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_comments_pipeline_item_id_fkey"
            columns: ["pipeline_item_id"]
            isOneToOne: false
            referencedRelation: "pipeline_items"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_items: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          id: string
          notes: string | null
          score: number | null
          stage: Database["public"]["Enums"]["pipeline_stage"] | null
          tender_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          score?: number | null
          stage?: Database["public"]["Enums"]["pipeline_stage"] | null
          tender_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          score?: number | null
          stage?: Database["public"]["Enums"]["pipeline_stage"] | null
          tender_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_items_tender_id_fkey"
            columns: ["tender_id"]
            isOneToOne: false
            referencedRelation: "tenders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_name: string | null
          company_size: string | null
          created_at: string | null
          id: string
          keywords: string[] | null
          onboarding_completed: boolean | null
          regions: string[] | null
          sectors: string[] | null
          siren: string | null
          user_id: string
        }
        Insert: {
          company_name?: string | null
          company_size?: string | null
          created_at?: string | null
          id?: string
          keywords?: string[] | null
          onboarding_completed?: boolean | null
          regions?: string[] | null
          sectors?: string[] | null
          siren?: string | null
          user_id: string
        }
        Update: {
          company_name?: string | null
          company_size?: string | null
          created_at?: string | null
          id?: string
          keywords?: string[] | null
          onboarding_completed?: boolean | null
          regions?: string[] | null
          sectors?: string[] | null
          siren?: string | null
          user_id?: string
        }
        Relationships: []
      }
      saved_searches: {
        Row: {
          created_at: string | null
          filters: Json | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          filters?: Json | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          filters?: Json | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      scrape_logs: {
        Row: {
          errors: string | null
          finished_at: string | null
          id: string
          items_found: number | null
          items_inserted: number | null
          source: string
          started_at: string
          status: string
        }
        Insert: {
          errors?: string | null
          finished_at?: string | null
          id?: string
          items_found?: number | null
          items_inserted?: number | null
          source: string
          started_at?: string
          status?: string
        }
        Update: {
          errors?: string | null
          finished_at?: string | null
          id?: string
          items_found?: number | null
          items_inserted?: number | null
          source?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      tenders: {
        Row: {
          buyer_name: string | null
          buyer_siret: string | null
          cpv_codes: string[] | null
          created_at: string | null
          deadline: string | null
          department: string | null
          estimated_amount: number | null
          id: string
          lots: Json | null
          object: string | null
          procedure_type: string | null
          publication_date: string | null
          reference: string | null
          region: string | null
          source: string | null
          source_url: string | null
          status: Database["public"]["Enums"]["tender_status"] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          buyer_name?: string | null
          buyer_siret?: string | null
          cpv_codes?: string[] | null
          created_at?: string | null
          deadline?: string | null
          department?: string | null
          estimated_amount?: number | null
          id?: string
          lots?: Json | null
          object?: string | null
          procedure_type?: string | null
          publication_date?: string | null
          reference?: string | null
          region?: string | null
          source?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["tender_status"] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          buyer_name?: string | null
          buyer_siret?: string | null
          cpv_codes?: string[] | null
          created_at?: string | null
          deadline?: string | null
          department?: string | null
          estimated_amount?: number | null
          id?: string
          lots?: Json | null
          object?: string | null
          procedure_type?: string | null
          publication_date?: string | null
          reference?: string | null
          region?: string | null
          source?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["tender_status"] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "viewer"
      pipeline_stage:
        | "spotted"
        | "analyzing"
        | "no_go"
        | "responding"
        | "won"
        | "lost"
      tender_status: "open" | "closed" | "cancelled" | "awarded"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "viewer"],
      pipeline_stage: [
        "spotted",
        "analyzing",
        "no_go",
        "responding",
        "won",
        "lost",
      ],
      tender_status: ["open", "closed", "cancelled", "awarded"],
    },
  },
} as const
