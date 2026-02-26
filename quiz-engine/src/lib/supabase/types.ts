// Hand-crafted Database type for @supabase/supabase-js v2.
// For production, generate with: supabase gen types typescript --local

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
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          role: "user" | "admin" | "super_admin";
          status: "active" | "banned";
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          role?: "user" | "admin" | "super_admin";
          status?: "active" | "banned";
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          display_name?: string | null;
          role?: "user" | "admin" | "super_admin";
          status?: "active" | "banned";
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      quizzes: {
        Row: {
          id: string;
          subject: "polish" | "math" | "informatics";
          title: string;
          description: string | null;
          status: "draft" | "published" | "archived";
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          subject: "polish" | "math" | "informatics";
          title: string;
          description?: string | null;
          status?: "draft" | "published" | "archived";
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          subject?: "polish" | "math" | "informatics";
          title?: string;
          description?: string | null;
          status?: "draft" | "published" | "archived";
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quizzes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      quiz_versions: {
        Row: {
          id: string;
          quiz_id: string;
          version: number;
          content: Json;
          change_note: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          quiz_id: string;
          version: number;
          content: Json;
          change_note?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          quiz_id?: string;
          version?: number;
          content?: Json;
          change_note?: string | null;
          is_active?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_versions_quiz_id_fkey";
            columns: ["quiz_id"];
            isOneToOne: false;
            referencedRelation: "quizzes";
            referencedColumns: ["id"];
          }
        ];
      };
      attempts: {
        Row: {
          id: string;
          user_id: string;
          quiz_id: string;
          quiz_version_id: string | null;
          status: "in_progress" | "submitted" | "abandoned";
          started_at: string;
          submitted_at: string | null;
          score: number;
          max_score: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          quiz_id: string;
          quiz_version_id?: string | null;
          status?: "in_progress" | "submitted" | "abandoned";
          started_at?: string;
          submitted_at?: string | null;
          score?: number;
          max_score?: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          quiz_id?: string;
          quiz_version_id?: string | null;
          status?: "in_progress" | "submitted" | "abandoned";
          started_at?: string;
          submitted_at?: string | null;
          score?: number;
          max_score?: number;
        };
        Relationships: [
          {
            foreignKeyName: "attempts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attempts_quiz_id_fkey";
            columns: ["quiz_id"];
            isOneToOne: false;
            referencedRelation: "quizzes";
            referencedColumns: ["id"];
          }
        ];
      };
      attempt_answers: {
        Row: {
          id: string;
          attempt_id: string;
          question_id: string;
          answer: Json;
          attachments: Json | null;
          score: number | null;
          max_score: number | null;
          feedback: Json | null;
          graded_by_model: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          attempt_id: string;
          question_id: string;
          answer: Json;
          attachments?: Json | null;
          score?: number | null;
          max_score?: number | null;
          feedback?: Json | null;
          graded_by_model?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          attempt_id?: string;
          question_id?: string;
          answer?: Json;
          attachments?: Json | null;
          score?: number | null;
          max_score?: number | null;
          feedback?: Json | null;
          graded_by_model?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "attempt_answers_attempt_id_fkey";
            columns: ["attempt_id"];
            isOneToOne: false;
            referencedRelation: "attempts";
            referencedColumns: ["id"];
          }
        ];
      };
      practice_log: {
        Row: {
          id: string;
          user_id: string;
          practice_date: string;
          source: "answer_submit" | "attempt_submit" | "manual_admin";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          practice_date: string;
          source: "answer_submit" | "attempt_submit" | "manual_admin";
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          practice_date?: string;
          source?: "answer_submit" | "attempt_submit" | "manual_admin";
        };
        Relationships: [
          {
            foreignKeyName: "practice_log_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      streaks: {
        Row: {
          user_id: string;
          current_streak: number;
          best_streak: number;
          last_practice_date: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          current_streak?: number;
          best_streak?: number;
          last_practice_date?: string | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          current_streak?: number;
          best_streak?: number;
          last_practice_date?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "streaks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      grading_criteria: {
        Row: {
          id: string;
          subject: "polish" | "math" | "informatics" | "global";
          question_type: string | null;
          name: string;
          system_prompt: string | null;
          rubric_template: string | null;
          grading_instructions: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          subject: "polish" | "math" | "informatics" | "global";
          question_type?: string | null;
          name: string;
          system_prompt?: string | null;
          rubric_template?: string | null;
          grading_instructions?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          subject?: "polish" | "math" | "informatics" | "global";
          question_type?: string | null;
          name?: string;
          system_prompt?: string | null;
          rubric_template?: string | null;
          grading_instructions?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      admin_audit_log: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          target_type: string;
          target_id: string;
          details: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          target_type: string;
          target_id: string;
          details?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          action?: string;
          target_type?: string;
          target_id?: string;
          details?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_super_admin: {
        Args: { uid?: string };
        Returns: boolean;
      };
      log_practice_and_update_streak: {
        Args: { p_user_id: string; p_source: string };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
