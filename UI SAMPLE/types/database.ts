export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string | null;
          role: string | null;
          created_at: string | null;
        };
        Insert: {
          id: string;
          email?: string | null;
          role?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string | null;
          role?: string | null;
          created_at?: string | null;
        };
      };
      projects: {
        Row: {
          id: string;
          name: string;
          status: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          status?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          status?: string | null;
          created_at?: string | null;
        };
      };
      tasks: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          status: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          status?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          status?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      daily_reports: {
        Row: {
          id: string;
          project_id: string;
          task_id: string;
          date: string;
          weather: string | null;
          content: string | null;
          status: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          task_id: string;
          date?: string;
          weather?: string | null;
          content?: string | null;
          status?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          task_id?: string;
          date?: string;
          weather?: string | null;
          content?: string | null;
          status?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          table_name: string;
          record_id: string;
          operation: string;
          old_data: Json | null;
          new_data: Json | null;
          changed_by: string | null;
          changed_at: string | null;
        };
        Insert: {
          id?: string;
          table_name: string;
          record_id: string;
          operation: string;
          old_data?: Json | null;
          new_data?: Json | null;
          changed_by?: string | null;
          changed_at?: string | null;
        };
        Update: {
          id?: string;
          table_name?: string;
          record_id?: string;
          operation?: string;
          old_data?: Json | null;
          new_data?: Json | null;
          changed_by?: string | null;
          changed_at?: string | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
