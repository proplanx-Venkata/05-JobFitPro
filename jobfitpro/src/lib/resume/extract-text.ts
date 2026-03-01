import mammoth from "mammoth";

export interface ExtractResult {
  text: string;
  pageCount: number;
}

/**
 * Extracts plain text and page count from a PDF buffer.
 * pdf-parse is loaded dynamically to avoid Next.js bundling issues
 * (the library reads test fixtures at module load time).
 */
async function extractFromPdf(buffer: Buffer): Promise<ExtractResult> {
  // require() avoids ESM/CJS interop issues with pdf-parse v2 in Next.js.
  // pdf-parse is in serverExternalPackages so it is never bundled.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse") as (
    buffer: Buffer
  ) => Promise<{ text: string; numpages: number }>;
  const data = await pdfParse(buffer);
  return { text: data.text, pageCount: data.numpages };
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
