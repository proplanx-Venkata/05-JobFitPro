const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB upload cap
const MAX_JD_PAGES = 5;
const MAX_TEXT_SIZE_BYTES = 50 * 1024;  // 50 KB — hard cap before Claude (all sources)
const MAX_JD_TEXT_CHARS = 25_000;       // ~5 pages × 5,000 chars — blocks dense-file exploits
const MIN_TEXT_LENGTH = 50;             // sanity floor for empty / unreadable docs

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateJdMimeType(mimeType: string): ValidationResult {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return { valid: false, error: "Only PDF and DOCX files are accepted." };
  }
  return { valid: true };
}

export function validateJdFileSize(sizeBytes: number): ValidationResult {
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size ${(sizeBytes / 1024 / 1024).toFixed(1)} MB exceeds the 5 MB limit.`,
    };
  }
  return { valid: true };
}

export function validateJdPageCount(pageCount: number): ValidationResult {
  if (pageCount > MAX_JD_PAGES) {
    return {
      valid: false,
      error: `Job description is ${pageCount} pages — maximum allowed is ${MAX_JD_PAGES}.`,
    };
  }
  return { valid: true };
}

/**
 * Validates URL-sourced text stays within the 50 KB limit.
 * For oversized URL text the caller should truncate before calling Claude;
 * this is surfaced as a warning-level limit (we truncate rather than reject).
 */
export function validateJdTextSize(sizeBytes: number): ValidationResult {
  if (sizeBytes > MAX_TEXT_SIZE_BYTES) {
    return {
      valid: false,
      error: `Extracted text (${Math.round(sizeBytes / 1024)} KB) exceeds the 50 KB limit.`,
    };
  }
  return { valid: true };
}

export function validateJdText(text: string): ValidationResult {
  const trimmed = text.trim();
  if (trimmed.length < MIN_TEXT_LENGTH) {
    return {
      valid: false,
      error: "Could not extract readable text from the job description.",
    };
  }
  // Hard cap — blocks dense-file exploits for DOCX and any source that slips
  // past the pdf-parse preflight (e.g. complex-font PDFs read by Claude).
  if (trimmed.length > MAX_JD_TEXT_CHARS) {
    return {
      valid: false,
      error:
        `Job description contains too much text (${trimmed.length.toLocaleString()} characters). ` +
        `Maximum allowed is ${MAX_JD_TEXT_CHARS.toLocaleString()}.`,
    };
  }
  return { valid: true };
}

/** Export for use in the route's DOCX/file validation path. */
export { MAX_JD_TEXT_CHARS };

export function validateUrl(raw: string): ValidationResult {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { valid: false, error: "URL must use http or https." };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid URL." };
  }
}

/** Byte limit used to truncate oversized URL text before Claude call. */
export const URL_TEXT_LIMIT_BYTES = MAX_TEXT_SIZE_BYTES;
