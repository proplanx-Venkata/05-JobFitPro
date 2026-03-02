import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import Anthropic from "@anthropic-ai/sdk";

export interface ExtractResult {
  text: string;
  pageCount: number;
}

// Max chars we'll accept from any resume — blocks font-size-1 / text-spam exploits.
// ~5,000 chars/page × 3 pages = 15,000 with generous headroom.
const MAX_PREFLIGHT_CHARS = 15_000;

/**
 * Cheap pre-flight check using pdf-parse (no Claude call).
 *
 * Returns { pageCount, charCount } if pdf-parse can read the file, or null if
 * it fails (corrupted, scanned, complex fonts). Failures are non-fatal — the
 * caller falls through to Claude extraction instead.
 *
 * Purpose: catch obviously over-page / over-dense PDFs BEFORE spending an API call.
 */
async function pdfPreflight(
  buffer: Buffer
): Promise<{ pageCount: number; charCount: number } | null> {
  try {
    const result = await pdfParse(buffer);
    const charCount = result.text.trim().length;
    // pdf-parse page count comes from PDF structure — reliable even when text
    // extraction is imperfect (garbled fonts etc.)
    return { pageCount: result.numpages, charCount };
  } catch {
    return null; // pdf-parse failed — let Claude handle it
  }
}

/**
 * Extracts plain text and page count from a PDF buffer using Claude's
 * native PDF document support. Handles all compression formats reliably.
 * Only called after the cheap pre-flight passes.
 */
async function extractFromPdf(buffer: Buffer): Promise<ExtractResult> {
  // ── 1. Cheap pre-flight (no Claude) ─────────────────────────────────────
  const preflight = await pdfPreflight(buffer);

  if (preflight !== null) {
    // Pre-flight succeeded — we have reliable page count and rough char count.
    if (preflight.pageCount > 3) {
      throw new Error(
        `Resume is ${preflight.pageCount} pages — maximum allowed is 3.`
      );
    }
    if (preflight.charCount > MAX_PREFLIGHT_CHARS) {
      throw new Error(
        `Resume contains too much text (${preflight.charCount.toLocaleString()} characters). ` +
          `Maximum allowed is ${MAX_PREFLIGHT_CHARS.toLocaleString()}. ` +
          "Please ensure your resume is a standard 3-page document."
      );
    }
  }

  // ── 2. Claude extraction (only reached for valid or unreadable files) ───
  const client = new Anthropic();
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096, // ~3,000 words — ample for 3 pages; hard cap on token burn
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: buffer.toString("base64"),
            },
          },
          {
            type: "text",
            text: "Extract all text from this PDF. Return ONLY the raw text, no commentary.",
          },
        ],
      },
    ],
  });

  const text = (message.content[0] as { type: "text"; text: string }).text;
  // Use pre-flight page count if available (structural, reliable); otherwise
  // estimate from extracted text length as fallback.
  const pageCount = preflight?.pageCount ?? Math.max(1, Math.ceil(text.length / 3_000));
  return { text, pageCount };
}

/**
 * Extracts plain text from a DOCX buffer using mammoth.
 * Page count is estimated from word count (~500 words / page).
 */
async function extractFromDocx(buffer: Buffer): Promise<ExtractResult> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value;
  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
  const pageCount = Math.max(1, Math.ceil(wordCount / 500));
  return { text, pageCount };
}

/**
 * Dispatches to the correct extractor based on MIME type.
 */
export async function extractText(
  buffer: Buffer,
  mimeType: string
): Promise<ExtractResult> {
  if (mimeType === "application/pdf") {
    return extractFromPdf(buffer);
  }
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return extractFromDocx(buffer);
  }
  throw new Error(`Unsupported MIME type: ${mimeType}`);
}
