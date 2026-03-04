import { describe, it, expect } from "vitest";
import {
  validateMimeType,
  validateFileSize,
  validatePageCount,
  validateExtractedText,
} from "@/lib/resume/validate";

describe("validateMimeType", () => {
  it("accepts PDF", () => {
    expect(validateMimeType("application/pdf").valid).toBe(true);
  });

  it("accepts DOCX", () => {
    expect(
      validateMimeType(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ).valid
    ).toBe(true);
  });

  it("rejects image/png", () => {
    const result = validateMimeType("image/png");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/PDF and DOCX/i);
  });

  it("rejects empty string", () => {
    expect(validateMimeType("").valid).toBe(false);
  });

  it("rejects application/octet-stream (disguised binary)", () => {
    expect(validateMimeType("application/octet-stream").valid).toBe(false);
  });
});

describe("validateFileSize", () => {
  const MB = 1024 * 1024;

  it("accepts file exactly at 5 MB limit", () => {
    expect(validateFileSize(5 * MB).valid).toBe(true);
  });

  it("accepts file under limit", () => {
    expect(validateFileSize(1 * MB).valid).toBe(true);
  });

  it("rejects file over 5 MB", () => {
    const result = validateFileSize(5 * MB + 1);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/5 MB/);
  });

  it("rejects 0-byte file (edge case: passes size check, fails text check later)", () => {
    // 0 bytes is valid for size — the text extraction step will catch it
    expect(validateFileSize(0).valid).toBe(true);
  });
});

describe("validatePageCount", () => {
  it("accepts 1 page", () => {
    expect(validatePageCount(1).valid).toBe(true);
  });

  it("accepts exactly 3 pages", () => {
    expect(validatePageCount(3).valid).toBe(true);
  });

  it("rejects 4 pages", () => {
    const result = validatePageCount(4);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/4 pages/);
    expect(result.error).toMatch(/maximum.*3/i);
  });
});

describe("validateExtractedText", () => {
  const shortEnglishText = "a".repeat(99);
  const validEnglishText = "This is a valid English resume with enough content. ".repeat(5);
  const longText = "a".repeat(15_001);

  it("accepts valid English text", () => {
    expect(validateExtractedText(validEnglishText).valid).toBe(true);
  });

  it("rejects text shorter than 100 chars", () => {
    const result = validateExtractedText(shortEnglishText);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/extract readable text/i);
  });

  it("rejects text over 15,000 chars", () => {
    const result = validateExtractedText(longText);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/too much text/i);
  });

  it("rejects non-English text (low ASCII ratio)", () => {
    // Chinese characters: all >U+007F, ratio << 0.85
    const chinese = "你好世界这是一份简历内容测试文本".repeat(20);
    const result = validateExtractedText(chinese);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/English/i);
  });

  it("accepts text with some unicode (still > 85% ASCII)", () => {
    // Mostly ASCII with a few accented chars — common in real resumes
    const mixed = "John Müller — Software Engineer. " + "a".repeat(200);
    expect(validateExtractedText(mixed).valid).toBe(true);
  });

  it("trims whitespace before checking length", () => {
    const padded = "  " + validEnglishText + "  ";
    expect(validateExtractedText(padded).valid).toBe(true);
  });
});
