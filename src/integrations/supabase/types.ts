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
      agent_playbooks: {
        Row: {
          config: Json
          created_at: string | null
          display_name: string
          evidence: string | null
          id: string
          is_active: boolean | null
          platform: string
          requires_auth: boolean | null
          requires_captcha: boolean | null
          scout_model: string | null
          scout_tokens_used: number | null
          steps: Json
          success_rate: number | null
          updated_at: string | null
          url_pattern: string
          version: number
        }
        Insert: {
          config?: Json
          created_at?: string | null
          display_name: string
          evidence?: string | null
          id?: string
          is_active?: boolean | null
          platform: string
          requires_auth?: boolean | null
          requires_captcha?: boolean | null
          scout_model?: string | null
          scout_tokens_used?: number | null
          steps?: Json
          success_rate?: number | null
          updated_at?: string | null
          url_pattern: string
          version?: number
        }
        Update: {
          config?: Json
          created_at?: string | null
          display_name?: string
          evidence?: string | null
          id?: string
          is_active?: boolean | null
          platform?: string
          requires_auth?: boolean | null
          requires_captcha?: boolean | null
          scout_model?: string | null
          scout_tokens_used?: number | null
          steps?: Json
          success_rate?: number | null
          updated_at?: string | null
          url_pattern?: string
          version?: number
        }
        Relationships: []
      }
      agent_runs: {
        Row: {
          browserbase_session_id: string | null
          captchas_solved: number | null
          cost_usd: number | null
          created_at: string | null
          dce_url: string
          duration_ms: number | null
          error_message: string | null
          files_downloaded: number | null
          finished_at: string | null
          id: string
          live_view_url: string | null
          platform: string
          started_at: string | null
          status: string
          tender_id: string | null
          trace: Json | null
          triggered_by: string | null
        }
        Insert: {
          browserbase_session_id?: string | null
          captchas_solved?: number | null
          cost_usd?: number | null
          created_at?: string | null
          dce_url: string
          duration_ms?: number | null
          error_message?: string | null
          files_downloaded?: number | null
          finished_at?: string | null
          id?: string
          live_view_url?: string | null
          platform: string
          started_at?: string | null
          status?: string
          tender_id?: string | null
          trace?: Json | null
          triggered_by?: string | null
        }
        Update: {
          browserbase_session_id?: string | null
          captchas_solved?: number | null
          cost_usd?: number | null
          created_at?: string | null
          dce_url?: string
          duration_ms?: number | null
          error_message?: string | null
          files_downloaded?: number | null
          finished_at?: string | null
          id?: string
          live_view_url?: string | null
          platform?: string
          started_at?: string | null
          status?: string
          tender_id?: string | null
          trace?: Json | null
          triggered_by?: string | null
        }
        Relationships: []
      }
      ai_prompt_versions: {
        Row: {
          created_at: string
          created_by: string | null
          fallback_model: string | null
          fallback_provider: string | null
          id: string
          model: string
          note: string | null
          prompt_id: string
          provider: string
          system_prompt: string
          temperature: number | null
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          fallback_model?: string | null
          fallback_provider?: string | null
          id?: string
          model: string
          note?: string | null
          prompt_id: string
          provider: string
          system_prompt: string
          temperature?: number | null
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          fallback_model?: string | null
          fallback_provider?: string | null
          id?: string
          model?: string
          note?: string | null
          prompt_id?: string
          provider?: string
          system_prompt?: string
          temperature?: number | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_prompt_versions_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "ai_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompts: {
        Row: {
          created_at: string
          description: string | null
          fallback_model: string | null
          fallback_provider: string | null
          id: string
          is_active: boolean
          key: string
          label: string
          model: string
          provider: string
          system_prompt: string
          temperature: number | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          fallback_model?: string | null
          fallback_provider?: string | null
          id?: string
          is_active?: boolean
          key: string
          label: string
          model: string
          provider?: string
          system_prompt: string
          temperature?: number | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          fallback_model?: string | null
          fallback_provider?: string | null
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          model?: string
          provider?: string
          system_prompt?: string
          temperature?: number | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      ai_request_log: {
        Row: {
          created_at: string
          fn: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fn: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fn?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
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
          award_criteria: Json | null
          award_date: string | null
          awarded_amount: number | null
          buyer_name: string | null
          buyer_siret: string | null
          contract_duration: string | null
          cpv_codes: string[] | null
          created_at: string | null
          id: string
          lots_awarded: Json | null
          notice_url: string | null
          notification_date: string | null
          num_candidates: number | null
          offers_admitted: number | null
          offers_received: number | null
          offers_rejected: number | null
          place_of_performance: string | null
          raw: Json
          reference: string | null
          source: string | null
          source_url: string | null
          sourcing_url_id: string | null
          subcontracting_share: number | null
          tender_id: string | null
          title: string | null
          updated_at: string
          winner_address: string | null
          winner_country: string | null
          winner_legal_form: string | null
          winner_name: string | null
          winner_siren: string | null
        }
        Insert: {
          award_criteria?: Json | null
          award_date?: string | null
          awarded_amount?: number | null
          buyer_name?: string | null
          buyer_siret?: string | null
          contract_duration?: string | null
          cpv_codes?: string[] | null
          created_at?: string | null
          id?: string
          lots_awarded?: Json | null
          notice_url?: string | null
          notification_date?: string | null
          num_candidates?: number | null
          offers_admitted?: number | null
          offers_received?: number | null
          offers_rejected?: number | null
          place_of_performance?: string | null
          raw?: Json
          reference?: string | null
          source?: string | null
          source_url?: string | null
          sourcing_url_id?: string | null
          subcontracting_share?: number | null
          tender_id?: string | null
          title?: string | null
          updated_at?: string
          winner_address?: string | null
          winner_country?: string | null
          winner_legal_form?: string | null
          winner_name?: string | null
          winner_siren?: string | null
        }
        Update: {
          award_criteria?: Json | null
          award_date?: string | null
          awarded_amount?: number | null
          buyer_name?: string | null
          buyer_siret?: string | null
          contract_duration?: string | null
          cpv_codes?: string[] | null
          created_at?: string | null
          id?: string
          lots_awarded?: Json | null
          notice_url?: string | null
          notification_date?: string | null
          num_candidates?: number | null
          offers_admitted?: number | null
          offers_received?: number | null
          offers_rejected?: number | null
          place_of_performance?: string | null
          raw?: Json
          reference?: string | null
          source?: string | null
          source_url?: string | null
          sourcing_url_id?: string | null
          subcontracting_share?: number | null
          tender_id?: string | null
          title?: string | null
          updated_at?: string
          winner_address?: string | null
          winner_country?: string | null
          winner_legal_form?: string | null
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
      buyer_follows: {
        Row: {
          buyer_name: string
          buyer_siret: string | null
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          buyer_name: string
          buyer_siret?: string | null
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          buyer_name?: string
          buyer_siret?: string | null
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      dce_downloads: {
        Row: {
          created_at: string | null
          enriched_data: Json | null
          error_message: string | null
          file_path: string | null
          id: string
          platform: string
          status: string
          tender_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          enriched_data?: Json | null
          error_message?: string | null
          file_path?: string | null
          id?: string
          platform: string
          status?: string
          tender_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          enriched_data?: Json | null
          error_message?: string | null
          file_path?: string | null
          id?: string
          platform?: string
          status?: string
          tender_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      dce_uploads: {
        Row: {
          agent_run_id: string | null
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          tender_id: string
          user_id: string
        }
        Insert: {
          agent_run_id?: string | null
          created_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          tender_id: string
          user_id: string
        }
        Update: {
          agent_run_id?: string | null
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          tender_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dce_uploads_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dce_uploads_tender_id_fkey"
            columns: ["tender_id"]
            isOneToOne: false
            referencedRelation: "tenders"
            referencedColumns: ["id"]
          },
        ]
      }
      ingest_cursors: {
        Row: {
          created_at: string
          id: string
          last_offset: number | null
          last_publication_date: string | null
          last_run_at: string | null
          last_status: string | null
          metadata: Json
          source_key: string
          sourcing_url_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_offset?: number | null
          last_publication_date?: string | null
          last_run_at?: string | null
          last_status?: string | null
          metadata?: Json
          source_key: string
          sourcing_url_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_offset?: number | null
          last_publication_date?: string | null
          last_run_at?: string | null
          last_status?: string | null
          metadata?: Json
          source_key?: string
          sourcing_url_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      memoir_conversations: {
        Row: {
          created_at: string
          id: string
          memoir_draft: Json | null
          messages: Json
          mode: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          memoir_draft?: Json | null
          messages?: Json
          mode?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          memoir_draft?: Json | null
          messages?: Json
          mode?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          pricing_strategy: Json | null
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
          pricing_strategy?: Json | null
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
          pricing_strategy?: Json | null
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
      platform_fingerprints: {
        Row: {
          confidence: number
          created_at: string
          detected_at: string
          evidence: Json
          host: string
          id: string
          platform: string
          updated_at: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          detected_at?: string
          evidence?: Json
          host: string
          id?: string
          platform: string
          updated_at?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          detected_at?: string
          evidence?: Json
          host?: string
          id?: string
          platform?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_certifications: string[] | null
          company_description: string | null
          company_equipment: string | null
          company_logo_path: string | null
          company_name: string | null
          company_past_work: string | null
          company_references: Json | null
          company_size: string | null
          company_skills: string | null
          company_team: string | null
          company_website: string | null
          created_at: string | null
          id: string
          keywords: string[] | null
          onboarding_completed: boolean | null
          primary_color: string | null
          regions: string[] | null
          secondary_color: string | null
          sectors: string[] | null
          siren: string | null
          user_id: string
        }
        Insert: {
          company_certifications?: string[] | null
          company_description?: string | null
          company_equipment?: string | null
          company_logo_path?: string | null
          company_name?: string | null
          company_past_work?: string | null
          company_references?: Json | null
          company_size?: string | null
          company_skills?: string | null
          company_team?: string | null
          company_website?: string | null
          created_at?: string | null
          id?: string
          keywords?: string[] | null
          onboarding_completed?: boolean | null
          primary_color?: string | null
          regions?: string[] | null
          secondary_color?: string | null
          sectors?: string[] | null
          siren?: string | null
          user_id: string
        }
        Update: {
          company_certifications?: string[] | null
          company_description?: string | null
          company_equipment?: string | null
          company_logo_path?: string | null
          company_name?: string | null
          company_past_work?: string | null
          company_references?: Json | null
          company_size?: string | null
          company_skills?: string | null
          company_team?: string | null
          company_website?: string | null
          created_at?: string | null
          id?: string
          keywords?: string[] | null
          onboarding_completed?: boolean | null
          primary_color?: string | null
          regions?: string[] | null
          secondary_color?: string | null
          sectors?: string[] | null
          siren?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reclassify_jobs: {
        Row: {
          classified: number
          created_at: string
          errors: Json
          finished_at: string | null
          id: string
          processed: number
          started_at: string
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          classified?: number
          created_at?: string
          errors?: Json
          finished_at?: string | null
          id?: string
          processed?: number
          started_at?: string
          status?: string
          total?: number
          updated_at?: string
        }
        Update: {
          classified?: number
          created_at?: string
          errors?: Json
          finished_at?: string | null
          id?: string
          processed?: number
          started_at?: string
          status?: string
          total?: number
          updated_at?: string
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
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          id: string
          plan: string
          quantity: number
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan: string
          quantity?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          quantity?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tender_analyses: {
        Row: {
          analysis_type: string
          created_at: string | null
          id: string
          model_used: string | null
          result: string | null
          tender_id: string
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          analysis_type: string
          created_at?: string | null
          id?: string
          model_used?: string | null
          result?: string | null
          tender_id: string
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          analysis_type?: string
          created_at?: string | null
          id?: string
          model_used?: string | null
          result?: string | null
          tender_id?: string
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tender_analyses_tender_id_fkey"
            columns: ["tender_id"]
            isOneToOne: false
            referencedRelation: "tenders"
            referencedColumns: ["id"]
          },
        ]
      }
      tenders: {
        Row: {
          additional_info: string | null
          award_criteria: string | null
          buyer_address: string | null
          buyer_contact: Json | null
          buyer_name: string | null
          buyer_norm: string | null
          buyer_siret: string | null
          contract_type: string | null
          cpv_codes: string[] | null
          created_at: string | null
          dce_url: string | null
          deadline: string | null
          department: string | null
          description: string | null
          enriched_data: Json | null
          estimated_amount: number | null
          execution_location: string | null
          id: string
          lots: Json | null
          nuts_code: string | null
          object: string | null
          participation_conditions: string | null
          procedure_type: string | null
          publication_date: string | null
          reference: string | null
          region: string | null
          source: string | null
          source_url: string | null
          status: Database["public"]["Enums"]["tender_status"] | null
          submission_url: string | null
          title: string
          title_norm: string | null
          updated_at: string | null
        }
        Insert: {
          additional_info?: string | null
          award_criteria?: string | null
          buyer_address?: string | null
          buyer_contact?: Json | null
          buyer_name?: string | null
          buyer_norm?: string | null
          buyer_siret?: string | null
          contract_type?: string | null
          cpv_codes?: string[] | null
          created_at?: string | null
          dce_url?: string | null
          deadline?: string | null
          department?: string | null
          description?: string | null
          enriched_data?: Json | null
          estimated_amount?: number | null
          execution_location?: string | null
          id?: string
          lots?: Json | null
          nuts_code?: string | null
          object?: string | null
          participation_conditions?: string | null
          procedure_type?: string | null
          publication_date?: string | null
          reference?: string | null
          region?: string | null
          source?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["tender_status"] | null
          submission_url?: string | null
          title: string
          title_norm?: string | null
          updated_at?: string | null
        }
        Update: {
          additional_info?: string | null
          award_criteria?: string | null
          buyer_address?: string | null
          buyer_contact?: Json | null
          buyer_name?: string | null
          buyer_norm?: string | null
          buyer_siret?: string | null
          contract_type?: string | null
          cpv_codes?: string[] | null
          created_at?: string | null
          dce_url?: string | null
          deadline?: string | null
          department?: string | null
          description?: string | null
          enriched_data?: Json | null
          estimated_amount?: number | null
          execution_location?: string | null
          id?: string
          lots?: Json | null
          nuts_code?: string | null
          object?: string | null
          participation_conditions?: string | null
          procedure_type?: string | null
          publication_date?: string | null
          reference?: string | null
          region?: string | null
          source?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["tender_status"] | null
          submission_url?: string | null
          title?: string
          title_norm?: string | null
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
      get_dce_sourcing_by_fingerprint: {
        Args: { _category?: string; _search?: string }
        Returns: {
          boamp_count: number
          category: string
          confidence: number
          fingerprint_source: string
          host: string
          platform: string
          sample_dce_url: string
          sample_tender_id: string
          ted_count: number
          total_count: number
        }[]
      }
      get_distinct_tender_procedures: {
        Args: never
        Returns: {
          procedure_type: string
        }[]
      }
      get_distinct_tender_sources: {
        Args: never
        Returns: {
          source: string
        }[]
      }
      get_unprocessed_tenders: {
        Args: { _limit?: number; _platform_filter?: string }
        Returns: {
          dce_url: string
          id: string
          title: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_norm: { Args: { _txt: string }; Returns: string }
      platform_category: { Args: { _host: string }; Returns: string }
      platform_host_norm: { Args: { _url: string }; Returns: string }
      platform_ts_to_category: { Args: { _p: string }; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
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
