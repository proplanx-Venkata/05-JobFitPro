/**
 * Structured content produced by the Claude cover-letter generation prompt.
 * Stored as JSONB in cover_letters.generated_content.
 */
export interface CoverLetterContent {
  /** Salutation line, e.g. "Dear Ms. Smith," or "Dear Hiring Manager," */
  greeting: string;
  /**
   * Exactly 3 paragraphs:
   *   [0] Opening — role interest + strongest relevant qualification
   *   [1] Body    — 2–3 key achievements / skills aligned to the JD
   *   [2] Closing — call to action + enthusiasm
   */
  paragraphs: [string, string, string];
  /** Valediction, e.g. "Sincerely," */
  closing: string;
  /** Candidate's full name (from resume personal_info.name) */
  candidate_name: string;
}
