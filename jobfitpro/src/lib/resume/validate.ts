const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_PAGES = 3;
const MIN_TEXT_LENGTH = 100; // sanity check for scanned / image-only files
const MIN_ASCII_RATIO = 0.85; // English language check

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateMimeType(mimeType: string): ValidationResult {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return { valid: false, error: "Only PDF and DOCX files are accepted." };
  }
  return { valid: true };
}

export function validateFileSize(sizeBytes: number): ValidationResult {
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size ${(sizeBytes / 1024 / 1024).toFixed(1)} MB exceeds the 5 MB limit.`,
    };
  }
  return { valid: true };
}

export function validatePageCount(pageCount: number): ValidationResult {
  if (pageCount > MAX_PAGES) {
    return {
      valid: false,
      error: `Resume is ${pageCount} pages — maximum allowed is ${MAX_PAGES}.`,
    };
  }
  return { valid: true };
}

export function validateExtractedText(text: string): ValidationResult {
  const trimmed = text.trim();

  if (trimmed.length < MIN_TEXT_LENGTH) {
    return {
      valid: false,
      error:
        "Could not extract readable text. The file may be scanned, image-only, or corrupt.",
    };
  }

  // Rough English-language check: high proportion of ASCII printable chars
  const asciiCount = trimmed
    .split("")
    .filter((c) => c.charCodeAt(0) < 128).length;
  const ratio = asciiCount / trimmed.length;

  if (ratio < MIN_ASCII_RATIO) {
    return {
      valid: false,
      error: "Only English-language resumes are supported.",
    };
  }

  return { valid: true };
}
