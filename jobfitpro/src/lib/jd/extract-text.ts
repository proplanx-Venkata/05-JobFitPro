import mammoth from "mammoth";

export interface JdExtractResult {
  text: string;
  pageCount: number | null; // null for URL source
  sizeBytes: number; // byte length of the extracted text
}

/**
 * Extracts text from a PDF buffer using pdf-parse.
 * Loaded via require() to avoid ESM/CJS issues with Next.js bundling.
 */
async function extractFromPdf(buffer: Buffer): Promise<JdExtractResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse") as (
    buffer: Buffer
  ) => Promise<{ text: string; numpages: number }>;
  const data = await pdfParse(buffer);
  return {
    text: data.text,
    pageCount: data.numpages,
    sizeBytes: Buffer.byteLength(data.text, "utf8"),
  };
}

/**
 * Extracts text from a DOCX buffer using mammoth.
 * Page count is estimated (~500 words / page).
 */
async function extractFromDocx(buffer: Buffer): Promise<JdExtractResult> {
  const result = await mammoth.extractRawText({ buffer });
  const wordCount = result.value
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
  const pageCount = Math.max(1, Math.ceil(wordCount / 500));
  return {
    text: result.value,
    pageCount,
    sizeBytes: Buffer.byteLength(result.value, "utf8"),
  };
}

/**
 * Fetches a URL and strips HTML to plain text.
 * Removes script/style tags, decodes common entities, and collapses whitespace.
 * Timeout: 10 seconds.
 */
async function extractFromUrl(url: string): Promise<JdExtractResult> {
  const response = await fetch(url, {
    headers: { "User-Agent": "JobFitPro/1.0 (resume-optimizer)" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch URL: HTTP ${response.status}`);
  }
  const html = await response.text();

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  return {
    text,
    pageCount: null,
    sizeBytes: Buffer.byteLength(text, "utf8"),
  };
}

export type JdSource =
  | { type: "pdf"; buffer: Buffer }
  | { type: "docx"; buffer: Buffer }
  | { type: "url"; url: string };

/**
 * Dispatches to the correct extractor based on source type.
 */
export async function extractJdText(source: JdSource): Promise<JdExtractResult> {
  if (source.type === "pdf") return extractFromPdf(source.buffer);
  if (source.type === "docx") return extractFromDocx(source.buffer);
  return extractFromUrl(source.url);
}
