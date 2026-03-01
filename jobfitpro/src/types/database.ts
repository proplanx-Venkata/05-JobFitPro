/**
 * Database type definitions for JobFit Pro.
 *
 * This file is a manual scaffold of the Supabase-generated types.
 * Replace with the generated version by running:
 *   npm run db:types
 * (after setting YOUR_PROJECT_REF in package.json)
 *
 * Must match the GenericSchema shape expected by @supabase/supabase-js v2.x:
 * Tables need Row / Insert / Update / Relationships.
 * Schema needs Tables / Views / Functions / Enums / CompositeTypes.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SubscriptionTier = "free" | "paid";
export type ResumeStatus = "uploading" | "processing" | "ready" | "error";
export type JdSourceType = "pdf" | "docx" | "url";
export type OutputStatus = "pending" | "generating" | "ready" | "error";
export type AtsCategory = "Excellent" | "Strong" | "Weak";
export type InterviewStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "aborted";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          tier: SubscriptionTier;
          monthly_version_count: number;
          monthly_reset_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          tier?: SubscriptionTier;
          monthly_version_count?: number;
          monthly_reset_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          tier?: SubscriptionTier;
          monthly_version_count?: number;
          monthly_reset_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      resumes: {
        Row: {
          id: string;
          user_id: string;
          storage_path: string;
          original_filename: string;
          file_size_bytes: number;
          mime_type: string;
          page_count: number | null;
          status: ResumeStatus;
          parsed_content: Json | null;
          parsed_at: string | null;
          is_active: boolean;
          replaced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          storage_path: string;
          original_filename: string;
          file_size_bytes: number;
          mime_type: string;
          page_count?: number | null;
          status?: ResumeStatus;
          parsed_content?: Json | null;
          parsed_at?: string | null;
          is_active?: boolean;
          replaced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          storage_path?: string;
          original_filename?: string;
          file_size_bytes?: number;
          mime_type?: string;
          page_count?: number | null;
          status?: ResumeStatus;
          parsed_content?: Json | null;
          parsed_at?: string | null;
          is_active?: boolean;
          replaced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      job_descriptions: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          company: string | null;
          source_type: JdSourceType;
          storage_path: string | null;
          source_url: string | null;
          raw_text: string | null;
          cleaned_text: string | null;
          page_count: number | null;
          text_size_bytes: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string | null;
          company?: string | null;
          source_type: JdSourceType;
          storage_path?: string | null;
          source_url?: string | null;
          raw_text?: string | null;
          cleaned_text?: string | null;
          page_count?: number | null;
          text_size_bytes?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string | null;
          company?: string | null;
          source_type?: JdSourceType;
          storage_path?: string | null;
          source_url?: string | null;
          raw_text?: string | null;
          cleaned_text?: string | null;
          page_count?: number | null;
          text_size_bytes?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };

      resume_versions: {
        Row: {
          id: string;
          user_id: string;
          resume_id: string;
          job_description_id: string;
          output_storage_path: string | null;
          output_filename: string | null;
          status: OutputStatus;
          rewritten_content: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          resume_id: string;
          job_description_id: string;
          output_storage_path?: string | null;
          output_filename?: string | null;
          status?: OutputStatus;
          rewritten_content?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          resume_id?: string;
          job_description_id?: string;
          output_storage_path?: string | null;
          output_filename?: string | null;
          status?: OutputStatus;
          rewritten_content?: Json | null;
          updated_at?: string;
        };
        Relationships: [];
      };

      cover_letters: {
        Row: {
          id: string;
          user_id: string;
          resume_version_id: string;
          output_storage_path: string | null;
          status: OutputStatus;
          generated_content: Json | null;
          recruiter_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          resume_version_id: string;
          output_storage_path?: string | null;
          status?: OutputStatus;
          generated_content?: Json | null;
          recruiter_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          resume_version_id?: string;
          output_storage_path?: string | null;
          status?: OutputStatus;
          generated_content?: Json | null;
          recruiter_name?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };

      interview_sessions: {
        Row: {
          id: string;
          user_id: string;
          resume_version_id: string;
          status: InterviewStatus;
          identified_gaps: Json | null;
          conversation_transcript: Json;
          approved_answers: Json | null;
          question_count: number;
          started_at: string | null;
          completed_at: string | null;
          aborted_at: string | null;
          abort_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          resume_version_id: string;
          status?: InterviewStatus;
          identified_gaps?: Json | null;
          conversation_transcript?: Json;
          approved_answers?: Json | null;
          question_count?: number;
          started_at?: string | null;
          completed_at?: string | null;
          aborted_at?: string | null;
          abort_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          resume_version_id?: string;
          status?: InterviewStatus;
          identified_gaps?: Json | null;
          conversation_transcript?: Json;
          approved_answers?: Json | null;
          question_count?: number;
          started_at?: string | null;
          completed_at?: string | null;
          aborted_at?: string | null;
          abort_reason?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };

      ats_scores: {
        Row: {
          id: string;
          user_id: string;
          resume_version_id: string;
          overall_score: number;
          category: AtsCategory;
          keyword_match_score: number | null;
          format_score: number | null;
          skills_score: number | null;
          experience_score: number | null;
          missing_keywords: Json | null;
          gap_explanations: Json | null;
          threshold: number;
          passes_threshold: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          resume_version_id: string;
          overall_score: number;
          category: AtsCategory;
          keyword_match_score?: number | null;
          format_score?: number | null;
          skills_score?: number | null;
          experience_score?: number | null;
          missing_keywords?: Json | null;
          gap_explanations?: Json | null;
          threshold?: number;
          created_at?: string;
        };
        // ats_scores is immutable — no client UPDATE policy in RLS
        Update: Record<string, never>;
        Relationships: [];
      };
    };

    Views: {
      [_ in never]: never;
    };

    Functions: {
      get_user_version_count: {
        Args: { p_user_id: string };
        Returns: number;
      };
      can_create_version: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
    };

    Enums: {
      subscription_tier: SubscriptionTier;
      resume_status: ResumeStatus;
      jd_source_type: JdSourceType;
      output_status: OutputStatus;
      ats_category: AtsCategory;
      interview_status: InterviewStatus;
    };

    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
