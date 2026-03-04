import { describe, it, expect } from "vitest";
import { computeAtsScore } from "@/types/ats";
import type { AtsClaudeOutput } from "@/types/ats";

function makeRaw(overrides: Partial<AtsClaudeOutput> = {}): AtsClaudeOutput {
  return {
    keyword_match_score: 80,
    skills_score: 75,
    experience_score: 70,
    format_score: 90,
    missing_keywords: [],
    gap_explanations: {},
    ...overrides,
  };
}

describe("computeAtsScore — overall_score formula", () => {
  // weights: keyword_match 40%, skills 25%, experience 25%, format 10%

  it("computes correct weighted overall score", () => {
    const result = computeAtsScore(makeRaw({
      keyword_match_score: 80,
      skills_score: 80,
      experience_score: 80,
      format_score: 80,
    }));
    expect(result.overall_score).toBe(80);
  });

  it("weights keyword_match at 40%", () => {
    const result = computeAtsScore(makeRaw({
      keyword_match_score: 100,
      skills_score: 0,
      experience_score: 0,
      format_score: 0,
    }));
    expect(result.overall_score).toBe(40);
  });

  it("weights skills at 25%", () => {
    const result = computeAtsScore(makeRaw({
      keyword_match_score: 0,
      skills_score: 100,
      experience_score: 0,
      format_score: 0,
    }));
    expect(result.overall_score).toBe(25);
  });

  it("weights experience at 25%", () => {
    const result = computeAtsScore(makeRaw({
      keyword_match_score: 0,
      skills_score: 0,
      experience_score: 100,
      format_score: 0,
    }));
    expect(result.overall_score).toBe(25);
  });

  it("weights format at 10%", () => {
    const result = computeAtsScore(makeRaw({
      keyword_match_score: 0,
      skills_score: 0,
      experience_score: 0,
      format_score: 100,
    }));
    expect(result.overall_score).toBe(10);
  });

  it("all 100s → overall 100", () => {
    const result = computeAtsScore(makeRaw({
      keyword_match_score: 100,
      skills_score: 100,
      experience_score: 100,
      format_score: 100,
    }));
    expect(result.overall_score).toBe(100);
  });

  it("all 0s → overall 0", () => {
    const result = computeAtsScore(makeRaw({
      keyword_match_score: 0,
      skills_score: 0,
      experience_score: 0,
      format_score: 0,
    }));
    expect(result.overall_score).toBe(0);
  });
});

describe("computeAtsScore — category thresholds", () => {
  it("≥ 85 → Excellent", () => {
    const result = computeAtsScore(makeRaw({
      keyword_match_score: 100,
      skills_score: 100,
      experience_score: 100,
      format_score: 100,
    }));
    expect(result.category).toBe("Excellent");
  });

  it("exactly 85 → Excellent", () => {
    // 85 * 0.4 + 85 * 0.25 + 85 * 0.25 + 85 * 0.1 = 85
    const result = computeAtsScore(makeRaw({
      keyword_match_score: 85,
      skills_score: 85,
      experience_score: 85,
      format_score: 85,
    }));
    expect(result.overall_score).toBe(85);
    expect(result.category).toBe("Excellent");
  });

  it("exactly 70 → Strong", () => {
    const result = computeAtsScore(makeRaw({
      keyword_match_score: 70,
      skills_score: 70,
      experience_score: 70,
      format_score: 70,
    }));
    expect(result.overall_score).toBe(70);
    expect(result.category).toBe("Strong");
  });

  it("84 → Strong (just below Excellent)", () => {
    const result = computeAtsScore(makeRaw({
      keyword_match_score: 84,
      skills_score: 84,
      experience_score: 84,
      format_score: 84,
    }));
    expect(result.overall_score).toBe(84);
    expect(result.category).toBe("Strong");
  });

  it("69 → Weak (just below Strong)", () => {
    const result = computeAtsScore(makeRaw({
      keyword_match_score: 69,
      skills_score: 69,
      experience_score: 69,
      format_score: 69,
    }));
    expect(result.overall_score).toBe(69);
    expect(result.category).toBe("Weak");
  });

  it("0 → Weak", () => {
    const result = computeAtsScore(makeRaw({
      keyword_match_score: 0,
      skills_score: 0,
      experience_score: 0,
      format_score: 0,
    }));
    expect(result.category).toBe("Weak");
  });
});

describe("computeAtsScore — clamping", () => {
  it("clamps scores above 100 to 100", () => {
    const result = computeAtsScore(makeRaw({
      keyword_match_score: 150,
      skills_score: 200,
      experience_score: 999,
      format_score: 110,
    }));
    expect(result.keyword_match_score).toBe(100);
    expect(result.skills_score).toBe(100);
    expect(result.experience_score).toBe(100);
    expect(result.format_score).toBe(100);
    expect(result.overall_score).toBe(100);
  });

  it("clamps negative scores to 0", () => {
    const result = computeAtsScore(makeRaw({
      keyword_match_score: -10,
      skills_score: -50,
      experience_score: -1,
      format_score: -100,
    }));
    expect(result.keyword_match_score).toBe(0);
    expect(result.skills_score).toBe(0);
    expect(result.experience_score).toBe(0);
    expect(result.format_score).toBe(0);
    expect(result.overall_score).toBe(0);
  });
});

describe("computeAtsScore — passthrough fields", () => {
  it("passes missing_keywords through unchanged", () => {
    const keywords = ["TypeScript", "Kubernetes", "GraphQL"];
    const result = computeAtsScore(makeRaw({ missing_keywords: keywords }));
    expect(result.missing_keywords).toEqual(keywords);
  });

  it("passes gap_explanations through unchanged", () => {
    const explanations = { TypeScript: "Not mentioned in resume" };
    const result = computeAtsScore(makeRaw({ gap_explanations: explanations }));
    expect(result.gap_explanations).toEqual(explanations);
  });

  it("passes empty missing_keywords array through", () => {
    const result = computeAtsScore(makeRaw({ missing_keywords: [] }));
    expect(result.missing_keywords).toEqual([]);
  });
});
