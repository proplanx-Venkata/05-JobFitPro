import mammoth from "mammoth";
import Anthropic from "@anthropic-ai/sdk";

export interface ExtractResult {
  text: string;
  pageCount: number;
}

/**
 * Extracts plain text and page count from a PDF buffer using Claude's
 * native PDF document support. Handles all compression formats reliably.
 */
async function extractFromPdf(buffer: Buffer): Promise<ExtractResult> {
  const client = new Anthropic();
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8096,
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
  const pageCount = Math.max(1, Math.ceil(text.length / 3000));
  return { text, pageCount };
}

/**
 * Extracts plain text from a DOCX buffer using mammoth.
 * Page count is estimated from word count (~500 words / page).
 */
async function extractFromDocx(buffer: Buffer): Promise<ExtractResult> {
  const result = await mammoth.extractRawText({ buffer });
  const wordCount = result.value.split(/\s+/).filter((w) => w.length > 0).length;
  const pageCount = Math.max(1, Math.ceil(wordCount / 500));
  return { text: result.value, pageCount };
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
