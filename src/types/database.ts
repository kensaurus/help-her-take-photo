/**
 * Supabase Database Types
 * Auto-generated types for type-safe database access
 */

export interface Database {
  public: {
    Tables: {
      devices: {
        Row: {
          id: string
          device_id: string
          device_name: string | null
          platform: string | null
          push_token: string | null
          app_version: string | null
          locale: string | null
          timezone: string | null
          last_active_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          device_id: string
          device_name?: string | null
          platform?: string | null
          push_token?: string | null
          app_version?: string | null
          locale?: string | null
          timezone?: string | null
          last_active_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          device_id?: string
          device_name?: string | null
          platform?: string | null
          push_token?: string | null
          app_version?: string | null
          locale?: string | null
          timezone?: string | null
          last_active_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      pairing_sessions: {
        Row: {
          id: string
          code: string
          device_id: string
          partner_device_id: string | null
          creator_role: string | null
          status: string | null
          ended_at: string | null
          created_at: string | null
          expires_at: string
        }
        Insert: {
          id?: string
          code: string
          device_id: string
          partner_device_id?: string | null
          creator_role?: string | null
          status?: string | null
          ended_at?: string | null
          created_at?: string | null
          expires_at: string
        }
        Update: {
          id?: string
          code?: string
          device_id?: string
          partner_device_id?: string | null
          creator_role?: string | null
          status?: string | null
          ended_at?: string | null
          created_at?: string | null
          expires_at?: string
        }
      }
      active_connections: {
        Row: {
          id: string
          session_id: string | null
          camera_device_id: string
          viewer_device_id: string
          signaling_channel: string | null
          is_streaming: boolean | null
          quality: string | null
          started_at: string | null
          last_heartbeat_at: string | null
        }
        Insert: {
          id?: string
          session_id?: string | null
          camera_device_id: string
          viewer_device_id: string
          signaling_channel?: string | null
          is_streaming?: boolean | null
          quality?: string | null
          started_at?: string | null
          last_heartbeat_at?: string | null
        }
        Update: {
          id?: string
          session_id?: string | null
          camera_device_id?: string
          viewer_device_id?: string
          signaling_channel?: string | null
          is_streaming?: boolean | null
          quality?: string | null
          started_at?: string | null
          last_heartbeat_at?: string | null
        }
      }
      captures: {
        Row: {
          id: string
          session_id: string | null
          camera_device_id: string
          viewer_device_id: string | null
          storage_path: string | null
          thumbnail_path: string | null
          width: number | null
          height: number | null
          file_size_bytes: number | null
          mime_type: string | null
          captured_by: string | null
          is_favorite: boolean | null
          deleted_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          session_id?: string | null
          camera_device_id: string
          viewer_device_id?: string | null
          storage_path?: string | null
          thumbnail_path?: string | null
          width?: number | null
          height?: number | null
          file_size_bytes?: number | null
          mime_type?: string | null
          captured_by?: string | null
          is_favorite?: boolean | null
          deleted_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          session_id?: string | null
          camera_device_id?: string
          viewer_device_id?: string | null
          storage_path?: string | null
          thumbnail_path?: string | null
          width?: number | null
          height?: number | null
          file_size_bytes?: number | null
          mime_type?: string | null
          captured_by?: string | null
          is_favorite?: boolean | null
          deleted_at?: string | null
          created_at?: string | null
        }
      }
      user_stats: {
        Row: {
          id: string
          device_id: string
          photos_taken: number | null
          photos_helped: number | null
          photos_received: number | null
          total_sessions: number | null
          camera_sessions: number | null
          viewer_sessions: number | null
          total_session_minutes: number | null
          current_streak_days: number | null
          longest_streak_days: number | null
          last_session_date: string | null
          achievements: unknown | null
          experience_points: number | null
          level: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          device_id: string
          photos_taken?: number | null
          photos_helped?: number | null
          photos_received?: number | null
          total_sessions?: number | null
          camera_sessions?: number | null
          viewer_sessions?: number | null
          total_session_minutes?: number | null
          current_streak_days?: number | null
          longest_streak_days?: number | null
          last_session_date?: string | null
          achievements?: unknown | null
          experience_points?: number | null
          level?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          device_id?: string
          photos_taken?: number | null
          photos_helped?: number | null
          photos_received?: number | null
          total_sessions?: number | null
          camera_sessions?: number | null
          viewer_sessions?: number | null
          total_session_minutes?: number | null
          current_streak_days?: number | null
          longest_streak_days?: number | null
          last_session_date?: string | null
          achievements?: unknown | null
          experience_points?: number | null
          level?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      user_settings: {
        Row: {
          id: string
          device_id: string
          theme: string | null
          language: string | null
          default_role: string | null
          camera_quality: string | null
          save_to_gallery: boolean | null
          show_grid: boolean | null
          enable_flash: boolean | null
          notifications_enabled: boolean | null
          sound_enabled: boolean | null
          haptics_enabled: boolean | null
          analytics_enabled: boolean | null
          crash_reports_enabled: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          device_id: string
          theme?: string | null
          language?: string | null
          default_role?: string | null
          camera_quality?: string | null
          save_to_gallery?: boolean | null
          show_grid?: boolean | null
          enable_flash?: boolean | null
          notifications_enabled?: boolean | null
          sound_enabled?: boolean | null
          haptics_enabled?: boolean | null
          analytics_enabled?: boolean | null
          crash_reports_enabled?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          device_id?: string
          theme?: string | null
          language?: string | null
          default_role?: string | null
          camera_quality?: string | null
          save_to_gallery?: boolean | null
          show_grid?: boolean | null
          enable_flash?: boolean | null
          notifications_enabled?: boolean | null
          sound_enabled?: boolean | null
          haptics_enabled?: boolean | null
          analytics_enabled?: boolean | null
          crash_reports_enabled?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      feedback: {
        Row: {
          id: string
          device_id: string | null
          type: string | null
          message: string
          email: string | null
          rating: number | null
          app_version: string | null
          platform: string | null
          status: string | null
          admin_notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          device_id?: string | null
          type?: string | null
          message: string
          email?: string | null
          rating?: number | null
          app_version?: string | null
          platform?: string | null
          status?: string | null
          admin_notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          device_id?: string | null
          type?: string | null
          message?: string
          email?: string | null
          rating?: number | null
          app_version?: string | null
          platform?: string | null
          status?: string | null
          admin_notes?: string | null
          created_at?: string | null
        }
      }
      session_events: {
        Row: {
          id: string
          session_id: string | null
          device_id: string
          event_type: string
          event_data: unknown | null
          created_at: string | null
        }
        Insert: {
          id?: string
          session_id?: string | null
          device_id: string
          event_type: string
          event_data?: unknown | null
          created_at?: string | null
        }
        Update: {
          id?: string
          session_id?: string | null
          device_id?: string
          event_type?: string
          event_data?: unknown | null
          created_at?: string | null
        }
      }
    }
  }
}

