/**
 * A single missing skill or keyword identified during gap analysis.
 */
export interface Gap {
  /** The missing skill/keyword as it appears in the JD. */
  keyword: string;
  /** Whether this was a required or preferred qualification. */
  category: "required" | "preferred";
  /** The JD section where this requirement was found (e.g. "Required Qualifications"). */
  section: string;
  /** Brief explanation of why it is a gap (≤15 words). */
  reason: string;
}

/**
 * Output of the Claude gap-analysis prompt.
 * At most 10 gaps, ordered by priority (most critical first).
 */
export interface GapAnalysisResult {
  gaps: Gap[];
}
