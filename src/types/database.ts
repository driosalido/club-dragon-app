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
    PostgrestVersion: "14.4"
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
      games: {
        Row: {
          added_by: string | null
          avg_duration_min: number | null
          bgg_id: number | null
          category: string | null
          created_at: string | null
          id: string
          max_players: number | null
          min_players: number | null
          name: string
          thumbnail_url: string | null
        }
        Insert: {
          added_by?: string | null
          avg_duration_min?: number | null
          bgg_id?: number | null
          category?: string | null
          created_at?: string | null
          id?: string
          max_players?: number | null
          min_players?: number | null
          name: string
          thumbnail_url?: string | null
        }
        Update: {
          added_by?: string | null
          avg_duration_min?: number | null
          bgg_id?: number | null
          category?: string | null
          created_at?: string | null
          id?: string
          max_players?: number | null
          min_players?: number | null
          name?: string
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_invitations: {
        Row: {
          admin_notes: string | null
          created_at: string
          guest_name: string
          id: string
          inviter_id: string
          is_paid: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          visit_date: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          guest_name: string
          id?: string
          inviter_id: string
          is_paid?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          visit_date: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          guest_name?: string
          id?: string
          inviter_id?: string
          is_paid?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          visit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_invitations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mesa_fija_requests: {
        Row: {
          admin_notes: string | null
          assigned_at: string | null
          created_at: string | null
          expected_duration_months: number | null
          expected_end_date: string | null
          expires_at: string | null
          game_id: string
          id: string
          queue_position: number
          reason: string | null
          requested_at: string | null
          requester_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          slot_id: string | null
          status: string | null
        }
        Insert: {
          admin_notes?: string | null
          assigned_at?: string | null
          created_at?: string | null
          expected_duration_months?: number | null
          expected_end_date?: string | null
          expires_at?: string | null
          game_id: string
          id?: string
          queue_position: number
          reason?: string | null
          requested_at?: string | null
          requester_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          slot_id?: string | null
          status?: string | null
        }
        Update: {
          admin_notes?: string | null
          assigned_at?: string | null
          created_at?: string | null
          expected_duration_months?: number | null
          expected_end_date?: string | null
          expires_at?: string | null
          game_id?: string
          id?: string
          queue_position?: number
          reason?: string | null
          requested_at?: string | null
          requester_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          slot_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mesa_fija_requests_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mesa_fija_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mesa_fija_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mesa_fija_requests_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "storage_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      session_participants: {
        Row: {
          joined_at: string | null
          session_id: string
          status: string | null
          user_id: string
        }
        Insert: {
          joined_at?: string | null
          session_id: string
          status?: string | null
          user_id: string
        }
        Update: {
          joined_at?: string | null
          session_id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string | null
          description: string | null
          game_id: string | null
          host_user_id: string | null
          id: string
          location_details: string | null
          location_type: string | null
          max_players: number
          min_players: number
          scheduled_date: string
          scheduled_time_end: string | null
          scheduled_time_start: string | null
          status: string | null
          stored_game_id: string | null
          title: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          game_id?: string | null
          host_user_id?: string | null
          id?: string
          location_details?: string | null
          location_type?: string | null
          max_players: number
          min_players: number
          scheduled_date: string
          scheduled_time_end?: string | null
          scheduled_time_start?: string | null
          status?: string | null
          stored_game_id?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          game_id?: string | null
          host_user_id?: string | null
          id?: string
          location_details?: string | null
          location_type?: string | null
          max_players?: number
          min_players?: number
          scheduled_date?: string
          scheduled_time_end?: string | null
          scheduled_time_start?: string | null
          status?: string | null
          stored_game_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sessions_stored_game"
            columns: ["stored_game_id"]
            isOneToOne: false
            referencedRelation: "stored_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_host_user_id_fkey"
            columns: ["host_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_slots: {
        Row: {
          id: string
          is_active: boolean | null
          label: string | null
          max_board_size: string | null
          notes: string | null
          pizzero: string | null
          slot_number: number
          slot_type: string | null
        }
        Insert: {
          id?: string
          is_active?: boolean | null
          label?: string | null
          max_board_size?: string | null
          notes?: string | null
          pizzero?: string | null
          slot_number: number
          slot_type?: string | null
        }
        Update: {
          id?: string
          is_active?: boolean | null
          label?: string | null
          max_board_size?: string | null
          notes?: string | null
          pizzero?: string | null
          slot_number?: number
          slot_type?: string | null
        }
        Relationships: []
      }
      stored_game_players: {
        Row: {
          faction_or_side: string | null
          joined_at: string | null
          stored_game_id: string
          user_id: string
        }
        Insert: {
          faction_or_side?: string | null
          joined_at?: string | null
          stored_game_id: string
          user_id: string
        }
        Update: {
          faction_or_side?: string | null
          joined_at?: string | null
          stored_game_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stored_game_players_stored_game_id_fkey"
            columns: ["stored_game_id"]
            isOneToOne: false
            referencedRelation: "stored_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stored_game_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stored_game_sessions: {
        Row: {
          created_at: string | null
          duration_minutes: number | null
          id: string
          linked_session_id: string | null
          logged_by: string | null
          next_turn_info: string | null
          session_date: string
          state_after_session: string | null
          stored_game_id: string | null
        }
        Insert: {
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          linked_session_id?: string | null
          logged_by?: string | null
          next_turn_info?: string | null
          session_date: string
          state_after_session?: string | null
          stored_game_id?: string | null
        }
        Update: {
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          linked_session_id?: string | null
          logged_by?: string | null
          next_turn_info?: string | null
          session_date?: string
          state_after_session?: string | null
          stored_game_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stored_game_sessions_linked_session_id_fkey"
            columns: ["linked_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stored_game_sessions_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stored_game_sessions_stored_game_id_fkey"
            columns: ["stored_game_id"]
            isOneToOne: false
            referencedRelation: "stored_games"
            referencedColumns: ["id"]
          },
        ]
      }
      stored_games: {
        Row: {
          completed_at: string | null
          current_state_notes: string | null
          expected_end_date: string | null
          game_id: string | null
          id: string
          last_session_at: string | null
          registered_by: string | null
          responsible_user_id: string | null
          scenario_notes: string | null
          slot_id: string | null
          started_at: string | null
          status: string | null
          turn_info: string | null
        }
        Insert: {
          completed_at?: string | null
          current_state_notes?: string | null
          expected_end_date?: string | null
          game_id?: string | null
          id?: string
          last_session_at?: string | null
          registered_by?: string | null
          responsible_user_id?: string | null
          scenario_notes?: string | null
          slot_id?: string | null
          started_at?: string | null
          status?: string | null
          turn_info?: string | null
        }
        Update: {
          completed_at?: string | null
          current_state_notes?: string | null
          expected_end_date?: string | null
          game_id?: string | null
          id?: string
          last_session_at?: string | null
          registered_by?: string | null
          responsible_user_id?: string | null
          scenario_notes?: string | null
          slot_id?: string | null
          started_at?: string | null
          status?: string | null
          turn_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stored_games_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stored_games_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stored_games_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stored_games_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "storage_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_login_requests: {
        Row: {
          approved_at: string | null
          consumed_at: string | null
          created_at: string
          expires_at: string
          status: string
          telegram_first_name: string | null
          telegram_id: number | null
          telegram_last_name: string | null
          telegram_photo_url: string | null
          telegram_username: string | null
          token: string
        }
        Insert: {
          approved_at?: string | null
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          status?: string
          telegram_first_name?: string | null
          telegram_id?: number | null
          telegram_last_name?: string | null
          telegram_photo_url?: string | null
          telegram_username?: string | null
          token: string
        }
        Update: {
          approved_at?: string | null
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          status?: string
          telegram_first_name?: string | null
          telegram_id?: number | null
          telegram_last_name?: string | null
          telegram_photo_url?: string | null
          telegram_username?: string | null
          token?: string
        }
        Relationships: []
      }
      user_availability: {
        Row: {
          day_of_week: number | null
          id: string
          time_end: string | null
          time_start: string | null
          user_id: string | null
        }
        Insert: {
          day_of_week?: number | null
          id?: string
          time_end?: string | null
          time_start?: string | null
          user_id?: string | null
        }
        Update: {
          day_of_week?: number | null
          id?: string
          time_end?: string | null
          time_start?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_availability_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_availability_exceptions: {
        Row: {
          available: boolean | null
          exception_date: string
          note: string | null
          user_id: string
        }
        Insert: {
          available?: boolean | null
          exception_date: string
          note?: string | null
          user_id: string
        }
        Update: {
          available?: boolean | null
          exception_date?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_availability_exceptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_games: {
        Row: {
          created_at: string | null
          game_id: string
          interest_level: string | null
          notes: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          game_id: string
          interest_level?: string | null
          notes?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          game_id?: string
          interest_level?: string | null
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_games_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_games_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string
          id: string
          is_active: boolean | null
          is_admin: boolean | null
          last_seen_at: string | null
          member_number: number | null
          telegram_id: number
          telegram_username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name: string
          id?: string
          is_active?: boolean | null
          is_admin?: boolean | null
          last_seen_at?: string | null
          member_number?: number | null
          telegram_id: number
          telegram_username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string
          id?: string
          is_active?: boolean | null
          is_admin?: boolean | null
          last_seen_at?: string | null
          member_number?: number | null
          telegram_id?: number
          telegram_username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_is_admin: { Args: never; Returns: boolean }
      auth_user_id: { Args: never; Returns: string }
      compute_storage_statuses:
        | { Args: never; Returns: undefined }
        | {
            Args: {
              critical_days?: number
              expired_days?: number
              warning_days?: number
            }
            Returns: undefined
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
