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
    PostgrestVersion: "13.0.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_uuid: string
          billing_email: string | null
          company_address: string | null
          company_email: string | null
          company_name: string
          company_phone: string | null
          created_at: string
          deleted_at: string | null
          is_active: boolean | null
          modified_at: string | null
          settings: Json | null
          timezone: string | null
        }
        Insert: {
          account_uuid?: string
          billing_email?: string | null
          company_address?: string | null
          company_email?: string | null
          company_name: string
          company_phone?: string | null
          created_at?: string
          deleted_at?: string | null
          is_active?: boolean | null
          modified_at?: string | null
          settings?: Json | null
          timezone?: string | null
        }
        Update: {
          account_uuid?: string
          billing_email?: string | null
          company_address?: string | null
          company_email?: string | null
          company_name?: string
          company_phone?: string | null
          created_at?: string
          deleted_at?: string | null
          is_active?: boolean | null
          modified_at?: string | null
          settings?: Json | null
          timezone?: string | null
        }
        Relationships: []
      }
      health_check: {
        Row: {
          checked_at: string
          id: number
        }
        Insert: {
          checked_at?: string
          id?: number
        }
        Update: {
          checked_at?: string
          id?: number
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          account_uuid: string
          cancelled_at: string | null
          created_at: string
          deleted_at: string | null
          expires_at: string | null
          modified_at: string | null
          payment_id: string | null
          payment_type: string | null
          status: string
          subscription_type: string
          subscription_uuid: string
          trial_ends_at: string | null
        }
        Insert: {
          account_uuid: string
          cancelled_at?: string | null
          created_at?: string
          deleted_at?: string | null
          expires_at?: string | null
          modified_at?: string | null
          payment_id?: string | null
          payment_type?: string | null
          status?: string
          subscription_type?: string
          subscription_uuid?: string
          trial_ends_at?: string | null
        }
        Update: {
          account_uuid?: string
          cancelled_at?: string | null
          created_at?: string
          deleted_at?: string | null
          expires_at?: string | null
          modified_at?: string | null
          payment_id?: string | null
          payment_type?: string | null
          status?: string
          subscription_type?: string
          subscription_uuid?: string
          trial_ends_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_account_uuid_fkey"
            columns: ["account_uuid"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["account_uuid"]
          },
        ]
      }
      users: {
        Row: {
          account_uuid: string
          avatar: string | null
          created_at: string
          deleted_at: string | null
          first_name: string | null
          invited_at: string | null
          invited_by: string | null
          is_active: boolean | null
          last_login_at: string | null
          last_name: string | null
          modified_at: string | null
          phone: string | null
          role: string
          user_email: string
          user_uuid: string
          username: string | null
        }
        Insert: {
          account_uuid: string
          avatar?: string | null
          created_at?: string
          deleted_at?: string | null
          first_name?: string | null
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          last_login_at?: string | null
          last_name?: string | null
          modified_at?: string | null
          phone?: string | null
          role?: string
          user_email: string
          user_uuid: string
          username?: string | null
        }
        Update: {
          account_uuid?: string
          avatar?: string | null
          created_at?: string
          deleted_at?: string | null
          first_name?: string | null
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          last_login_at?: string | null
          last_name?: string | null
          modified_at?: string | null
          phone?: string | null
          role?: string
          user_email?: string
          user_uuid?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_account_uuid_fkey"
            columns: ["account_uuid"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["account_uuid"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      get_current_user_account_info: {
        Args: never
        Returns: {
          account_uuid: string
          user_role: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
