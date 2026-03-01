import type { AtsCategory } from "@/types/database";

/**
 * Raw component scores returned by Claude.
 * overall_score and category are computed server-side from these.
 */
export interface AtsClaudeOutput {
  /** % of JD keywords present in the resume (exact + synonyms). */
  keyword_match_score: number;
  /** ATS format friendliness (no tables, standard sections, clean text). */
  format_score: number;
  /** Alignment of candidate's skills section with JD requirements. */
  skills_score: number;
  /** Relevance of experience history (seniority, responsibilities, industry). */
  experience_score: number;
  /** JD keywords/skills that remain absent from the resume after rewriting. */
  missing_keywords: string[];
  /** Brief explanation per missing keyword (≤15 words each). */
  gap_explanations: Record<string, string>;
}

/**
 * Computed score ready to insert into ats_scores.
 */
export interface AtsScoreInsert {
  overall_score: number;
  category: AtsCategory;
  keyword_match_score: number;
  format_score: number;
  skills_score: number;
  experience_score: number;
  missing_keywords: string[];
  gap_explanations: Record<string, string>;
}

/**
 * Derives overall_score (weighted average) and category from component scores.
 *
 * Weights: keyword_match 40%, skills 25%, experience 25%, format 10%.
 * Category: Excellent ≥ 85 | Strong ≥ 70 | Weak < 70.
 */
export function computeAtsScore(raw: AtsClaudeOutput): AtsScoreInsert {
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

  const km = clamp(raw.keyword_match_score);
  const sk = clamp(raw.skills_score);
  const ex = clamp(raw.experience_score);
  const fm = clamp(raw.format_score);

  const overall = clamp(km * 0.4 + sk * 0.25 + ex * 0.25 + fm * 0.1);

  const category: AtsCategory =
    overall >= 85 ? "Excellent" : overall >= 70 ? "Strong" : "Weak";

  return {
    overall_score: overall,
    category,
    keyword_match_score: km,
    skills_score: sk,
    experience_score: ex,
    format_score: fm,
    missing_keywords: raw.missing_keywords,
    gap_explanations: raw.gap_explanations,
  };
}
