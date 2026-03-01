import type {
  OutputStatus,
  InterviewStatus,
  AtsCategory,
  JdSourceType,
} from "@/types/database";

/**
 * One entry in the user's application history list.
 * Aggregates resume_version + JD + interview + latest ATS score + cover letter
 * into a single flat shape for easy rendering.
 */
export interface HistoryEntry {
  resume_version: {
    id: string;
    status: OutputStatus;
    output_filename: string | null;
    output_storage_path: string | null;
    created_at: string;
  };
  job_description: {
    id: string;
    title: string | null;
    company: string | null;
    source_type: JdSourceType;
  };
  interview: {
    id: string;
    status: InterviewStatus;
    question_count: number;
    completed_at: string | null;
  } | null;
  /** Most recent ATS score for this version (null if not yet scored). */
  latest_ats_score: {
    id: string;
    overall_score: number;
    category: AtsCategory;
    passes_threshold: boolean;
    created_at: string;
  } | null;
  cover_letter: {
    id: string;
    status: OutputStatus;
    output_storage_path: string | null;
  } | null;
}

/**
 * Full detail for a single history entry — all fields included.
 * Returned by GET /api/history/[version_id].
 */
export interface HistoryDetail {
  resume_version: {
    id: string;
    status: OutputStatus;
    rewritten_content: unknown;
    output_filename: string | null;
    output_storage_path: string | null;
    created_at: string;
    updated_at: string;
  };
  job_description: {
    id: string;
    title: string | null;
    company: string | null;
    source_type: JdSourceType;
    source_url: string | null;
    cleaned_text: string | null;
    page_count: number | null;
    created_at: string;
  };
  interview: {
    id: string;
    status: InterviewStatus;
    identified_gaps: unknown;
    conversation_transcript: unknown;
    approved_answers: unknown;
    question_count: number;
    started_at: string | null;
    completed_at: string | null;
    aborted_at: string | null;
    abort_reason: string | null;
    created_at: string;
  } | null;
  /** All ATS scores for this version, newest first. */
  ats_scores: {
    id: string;
    overall_score: number;
    category: AtsCategory;
    keyword_match_score: number | null;
    format_score: number | null;
    skills_score: number | null;
    experience_score: number | null;
    missing_keywords: unknown;
    gap_explanations: unknown;
    threshold: number;
    passes_threshold: boolean;
    created_at: string;
  }[];
  cover_letter: {
    id: string;
    status: OutputStatus;
    generated_content: unknown;
    recruiter_name: string | null;
    output_storage_path: string | null;
    created_at: string;
  } | null;
}
