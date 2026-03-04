import { describe, it, expect } from "vitest";

/**
 * Tests for the resolveStep() workflow logic from the apply page.
 * Extracted here to make it independently testable.
 */

type WorkflowStep = "gap_analysis" | "interview" | "rewrite" | "cover_letter" | "ats_score";

function resolveStep(
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

describe("resolveStep — workflow stepper logic", () => {
  describe("gap_analysis step", () => {
    it("interview=pending → gap_analysis regardless of version status", () => {
      expect(resolveStep("pending", "pending", false)).toBe("gap_analysis");
      expect(resolveStep("pending", "ready", true)).toBe("gap_analysis");
    });
  });

  describe("interview step", () => {
    it("interview=in_progress → interview step", () => {
      expect(resolveStep("in_progress", "pending", false)).toBe("interview");
      expect(resolveStep("in_progress", "ready", true)).toBe("interview");
    });
  });

  describe("rewrite step", () => {
    it("interview=completed + version=pending → rewrite", () => {
      expect(resolveStep("completed", "pending", false)).toBe("rewrite");
    });

    it("interview=completed + version=generating → rewrite (in progress)", () => {
      expect(resolveStep("completed", "generating", false)).toBe("rewrite");
    });

    it("interview=completed + version=error → rewrite (retry)", () => {
      expect(resolveStep("completed", "error", false)).toBe("rewrite");
    });
  });

  describe("cover_letter step", () => {
    it("version=ready + no cover letter → cover_letter", () => {
      expect(resolveStep("completed", "ready", false)).toBe("cover_letter");
    });
  });

  describe("ats_score step", () => {
    it("version=ready + cover letter exists → ats_score", () => {
      expect(resolveStep("completed", "ready", true)).toBe("ats_score");
    });

    it("aborted interview + version=ready + cover letter → ats_score", () => {
      // aborted is not in_progress or pending, so falls through to version check
      expect(resolveStep("aborted", "ready", true)).toBe("ats_score");
    });
  });

  describe("regression: cover letter regeneration bug", () => {
    it("hasCoverLetter=false after regen failure must stay at cover_letter, not ats_score", () => {
      // If .single() fails and coverLetter is null, step should NOT jump to ats_score
      expect(resolveStep("completed", "ready", false)).toBe("cover_letter");
    });

    it("hasCoverLetter=true after successful regen must reach ats_score", () => {
      expect(resolveStep("completed", "ready", true)).toBe("ats_score");
    });
  });
});
