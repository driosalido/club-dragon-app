export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          telegram_id: number
          telegram_username: string | null
          display_name: string
          avatar_url: string | null
          bio: string | null
          is_admin: boolean
          is_active: boolean
          created_at: string
          last_seen_at: string | null
          member_number: number | null
        }
        Insert: {
          id?: string
          telegram_id: number
          telegram_username?: string | null
          display_name: string
          avatar_url?: string | null
          bio?: string | null
          is_admin?: boolean
          is_active?: boolean
          created_at?: string
          last_seen_at?: string | null
          member_number?: number | null
        }
        Update: {
          id?: string
          telegram_id?: number
          telegram_username?: string | null
          display_name?: string
          avatar_url?: string | null
          bio?: string | null
          is_admin?: boolean
          is_active?: boolean
          created_at?: string
          last_seen_at?: string | null
          member_number?: number | null
        }
        Relationships: []
      }
      games: {
        Row: {
          id: string
          bgg_id: number | null
          name: string
          category: 'wargame_tablero' | 'wargame_figuras' | 'euros' | 'rol' | 'abstracto' | 'familiar' | null
          min_players: number | null
          max_players: number | null
          avg_duration_min: number | null
          thumbnail_url: string | null
          added_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          bgg_id?: number | null
          name: string
          category?: 'wargame_tablero' | 'wargame_figuras' | 'euros' | 'rol' | 'abstracto' | 'familiar' | null
          min_players?: number | null
          max_players?: number | null
          avg_duration_min?: number | null
          thumbnail_url?: string | null
          added_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          bgg_id?: number | null
          name?: string
          category?: 'wargame_tablero' | 'wargame_figuras' | 'euros' | 'rol' | 'abstracto' | 'familiar' | null
          min_players?: number | null
          max_players?: number | null
          avg_duration_min?: number | null
          thumbnail_url?: string | null
          added_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      user_games: {
        Row: {
          user_id: string
          game_id: string
          interest_level: 'want_to_play' | 'own_and_teach' | 'learning'
          notes: string | null
          created_at: string
        }
        Insert: {
          user_id: string
          game_id: string
          interest_level: 'want_to_play' | 'own_and_teach' | 'learning'
          notes?: string | null
          created_at?: string
        }
        Update: {
          user_id?: string
          game_id?: string
          interest_level?: 'want_to_play' | 'own_and_teach' | 'learning'
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          id: string
          host_user_id: string
          game_id: string | null
          stored_game_id: string | null
          title: string | null
          description: string | null
          status: 'open' | 'full' | 'confirmed' | 'cancelled' | 'completed'
          location_type: 'club' | 'home' | 'online' | null
          location_details: string | null
          scheduled_date: string
          scheduled_time_start: string | null
          scheduled_time_end: string | null
          min_players: number
          max_players: number
          created_at: string
        }
        Insert: {
          id?: string
          host_user_id: string
          game_id?: string | null
          stored_game_id?: string | null
          title?: string | null
          description?: string | null
          status?: 'open' | 'full' | 'confirmed' | 'cancelled' | 'completed'
          location_type?: 'club' | 'home' | 'online' | null
          location_details?: string | null
          scheduled_date: string
          scheduled_time_start?: string | null
          scheduled_time_end?: string | null
          min_players: number
          max_players: number
          created_at?: string
        }
        Update: {
          id?: string
          host_user_id?: string
          game_id?: string | null
          stored_game_id?: string | null
          title?: string | null
          description?: string | null
          status?: 'open' | 'full' | 'confirmed' | 'cancelled' | 'completed'
          location_type?: 'club' | 'home' | 'online' | null
          location_details?: string | null
          scheduled_date?: string
          scheduled_time_start?: string | null
          scheduled_time_end?: string | null
          min_players?: number
          max_players?: number
          created_at?: string
        }
        Relationships: []
      }
      session_participants: {
        Row: {
          session_id: string
          user_id: string
          status: 'interested' | 'confirmed' | 'waitlist' | 'declined'
          joined_at: string
        }
        Insert: {
          session_id: string
          user_id: string
          status: 'interested' | 'confirmed' | 'waitlist' | 'declined'
          joined_at?: string
        }
        Update: {
          session_id?: string
          user_id?: string
          status?: 'interested' | 'confirmed' | 'waitlist' | 'declined'
          joined_at?: string
        }
        Relationships: []
      }
      storage_slots: {
        Row: {
          id: string
          slot_number: number
          label: string | null
          notes: string | null
          is_active: boolean
          max_board_size: 'small' | 'medium' | 'large' | 'xl' | null
          slot_type: 'pizzero' | 'mesa_fija'
          pizzero: 'A' | 'B' | 'C' | null
        }
        Insert: {
          id?: string
          slot_number: number
          label?: string | null
          notes?: string | null
          is_active?: boolean
          max_board_size?: 'small' | 'medium' | 'large' | 'xl' | null
          slot_type?: 'pizzero' | 'mesa_fija'
          pizzero?: 'A' | 'B' | 'C' | null
        }
        Update: {
          id?: string
          slot_number?: number
          label?: string | null
          notes?: string | null
          is_active?: boolean
          max_board_size?: 'small' | 'medium' | 'large' | 'xl' | null
          slot_type?: 'pizzero' | 'mesa_fija'
          pizzero?: 'A' | 'B' | 'C' | null
        }
        Relationships: []
      }
      mesa_fija_requests: {
        Row: {
          id: string
          slot_id: string | null
          requester_id: string
          game_id: string
          status: 'pending' | 'queued' | 'rejected' | 'assigned' | 'cancelled' | 'expired'
          queue_position: number
          reason: string | null
          admin_notes: string | null
          reviewed_by: string | null
          requested_at: string
          reviewed_at: string | null
          assigned_at: string | null
          expires_at: string | null
          expected_end_date: string | null
          expected_duration_months: number | null
          created_at: string
        }
        Insert: {
          id?: string
          slot_id?: string | null
          requester_id: string
          game_id: string
          status?: 'pending' | 'queued' | 'rejected' | 'assigned' | 'cancelled' | 'expired'
          queue_position: number
          reason?: string | null
          admin_notes?: string | null
          reviewed_by?: string | null
          requested_at?: string
          reviewed_at?: string | null
          assigned_at?: string | null
          expires_at?: string | null
          expected_end_date?: string | null
          expected_duration_months?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          slot_id?: string | null
          requester_id?: string
          game_id?: string
          status?: 'pending' | 'queued' | 'rejected' | 'assigned' | 'cancelled' | 'expired'
          queue_position?: number
          reason?: string | null
          admin_notes?: string | null
          reviewed_by?: string | null
          requested_at?: string
          reviewed_at?: string | null
          assigned_at?: string | null
          expires_at?: string | null
          expected_end_date?: string | null
          expected_duration_months?: number | null
          created_at?: string
        }
        Relationships: []
      }
      telegram_login_requests: {
        Row: {
          token: string
          status: 'pending' | 'approved' | 'rejected' | 'consumed'
          telegram_id: number | null
          telegram_username: string | null
          telegram_first_name: string | null
          telegram_last_name: string | null
          telegram_photo_url: string | null
          created_at: string
          expires_at: string
          approved_at: string | null
          consumed_at: string | null
        }
        Insert: {
          token: string
          status?: 'pending' | 'approved' | 'rejected' | 'consumed'
          telegram_id?: number | null
          telegram_username?: string | null
          telegram_first_name?: string | null
          telegram_last_name?: string | null
          telegram_photo_url?: string | null
          created_at?: string
          expires_at: string
          approved_at?: string | null
          consumed_at?: string | null
        }
        Update: {
          token?: string
          status?: 'pending' | 'approved' | 'rejected' | 'consumed'
          telegram_id?: number | null
          telegram_username?: string | null
          telegram_first_name?: string | null
          telegram_last_name?: string | null
          telegram_photo_url?: string | null
          created_at?: string
          expires_at?: string
          approved_at?: string | null
          consumed_at?: string | null
        }
        Relationships: []
      }
      stored_games: {
        Row: {
          id: string
          slot_id: string | null
          game_id: string | null
          registered_by: string | null
          responsible_user_id: string | null
          status: 'active' | 'warning' | 'critical' | 'expired' | 'completed' | 'evicted'
          started_at: string
          last_session_at: string
          scenario_notes: string | null
          current_state_notes: string | null
          turn_info: string | null
          expected_end_date: string | null
          completed_at: string | null
        }
        Insert: {
          id?: string
          slot_id?: string | null
          game_id?: string | null
          registered_by?: string | null
          responsible_user_id?: string | null
          status?: 'active' | 'warning' | 'critical' | 'expired' | 'completed' | 'evicted'
          started_at?: string
          last_session_at?: string
          scenario_notes?: string | null
          current_state_notes?: string | null
          turn_info?: string | null
          expected_end_date?: string | null
          completed_at?: string | null
        }
        Update: {
          id?: string
          slot_id?: string | null
          game_id?: string | null
          registered_by?: string | null
          responsible_user_id?: string | null
          status?: 'active' | 'warning' | 'critical' | 'expired' | 'completed' | 'evicted'
          started_at?: string
          last_session_at?: string
          scenario_notes?: string | null
          current_state_notes?: string | null
          turn_info?: string | null
          expected_end_date?: string | null
          completed_at?: string | null
        }
        Relationships: []
      }
      stored_game_players: {
        Row: {
          stored_game_id: string
          user_id: string
          faction_or_side: string | null
          joined_at: string
        }
        Insert: {
          stored_game_id: string
          user_id: string
          faction_or_side?: string | null
          joined_at?: string
        }
        Update: {
          stored_game_id?: string
          user_id?: string
          faction_or_side?: string | null
          joined_at?: string
        }
        Relationships: []
      }
      stored_game_sessions: {
        Row: {
          id: string
          stored_game_id: string
          logged_by: string | null
          session_date: string
          duration_minutes: number | null
          state_after_session: string | null
          next_turn_info: string | null
          linked_session_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          stored_game_id: string
          logged_by?: string | null
          session_date: string
          duration_minutes?: number | null
          state_after_session?: string | null
          next_turn_info?: string | null
          linked_session_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          stored_game_id?: string
          logged_by?: string | null
          session_date?: string
          duration_minutes?: number | null
          state_after_session?: string | null
          next_turn_info?: string | null
          linked_session_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      user_availability: {
        Row: {
          id: string
          user_id: string
          day_of_week: number | null
          time_start: string | null
          time_end: string | null
        }
        Insert: {
          id?: string
          user_id: string
          day_of_week?: number | null
          time_start?: string | null
          time_end?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          day_of_week?: number | null
          time_start?: string | null
          time_end?: string | null
        }
        Relationships: []
      }
      user_availability_exceptions: {
        Row: {
          user_id: string
          exception_date: string
          available: boolean
          note: string | null
        }
        Insert: {
          user_id: string
          exception_date: string
          available?: boolean
          note?: string | null
        }
        Update: {
          user_id?: string
          exception_date?: string
          available?: boolean
          note?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      auth_user_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      auth_is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      compute_storage_statuses: {
        Args: {
          warning_days?: number
          critical_days?: number
          expired_days?: number
        }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
