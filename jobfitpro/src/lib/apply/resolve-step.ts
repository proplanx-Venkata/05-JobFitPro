export type WorkflowStep =
  | "gap_analysis"
  | "interview"
  | "rewrite"
  | "cover_letter"
  | "ats_score";

export function resolveStep(
  interviewStatus: string,
  versionStatus: string,
  hasCoverLetter: boolean
): WorkflowStep {
  if (interviewStatus === "pending") return "gap_analysis";
  if (interviewStatus === "in_progress") return "interview";
  if (
    versionStatus === "pending" ||
    versionStatus === "error" ||
    versionStatus === "generating"
  )
    return "rewrite";
  if (versionStatus === "ready" && !hasCoverLetter) return "cover_letter";
  return "ats_score";
}
