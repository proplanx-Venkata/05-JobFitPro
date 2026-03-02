import { promises as dns } from "dns";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import Anthropic from "@anthropic-ai/sdk";

export interface JdExtractResult {
  text: string;
  pageCount: number | null; // null for URL source
  sizeBytes: number; // byte length of the extracted text
}

// JD limits: 5 pages, ~5000 chars/page = 25,000 chars max
const MAX_JD_PAGES = 5;
const MAX_JD_PREFLIGHT_CHARS = 25_000;

// Raw HTML fetch cap — stop reading after this many bytes before stripping tags
const MAX_HTML_FETCH_BYTES = 500_000; // 500 KB

/**
 * Cheap pdf-parse preflight — gets real page count and rough char count
 * without calling Claude. Returns null if pdf-parse can't read the file.
 */
async function jdPdfPreflight(
  buffer: Buffer
): Promise<{ pageCount: number; charCount: number } | null> {
  try {
    const result = await pdfParse(buffer);
    return { pageCount: result.numpages, charCount: result.text.trim().length };
  } catch {
    return null;
  }
}

/**
 * Extracts text from a PDF buffer.
 * Runs a free pdf-parse preflight first; only calls Claude if the file passes.
 */
async function extractFromPdf(buffer: Buffer): Promise<JdExtractResult> {
  // ── 1. Cheap preflight (no Claude) ──────────────────────────────────────
  const preflight = await jdPdfPreflight(buffer);

  if (preflight !== null) {
    if (preflight.pageCount > MAX_JD_PAGES) {
      throw new Error(
        `Job description is ${preflight.pageCount} pages — maximum allowed is ${MAX_JD_PAGES}.`
      );
    }
    if (preflight.charCount > MAX_JD_PREFLIGHT_CHARS) {
      throw new Error(
        `Job description contains too much text (${preflight.charCount.toLocaleString()} characters). ` +
          `Maximum allowed is ${MAX_JD_PREFLIGHT_CHARS.toLocaleString()}.`
      );
    }
  }

  // ── 2. Claude extraction (only for valid or unreadable files) ────────────
  const client = new Anthropic();
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096, // ample for 5 pages; hard cap on token burn
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
  const pageCount =
    preflight?.pageCount ?? Math.max(1, Math.ceil(text.length / 3_000));
  return {
    text,
    pageCount,
    sizeBytes: Buffer.byteLength(text, "utf8"),
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
 * Returns true if the IP address falls within a private/reserved range.
 * Covers IPv4 loopback, RFC1918, link-local (AWS metadata), and IPv6 locals.
 */
function isPrivateIp(ip: string): boolean {
  return [
    /^127\./,                           // IPv4 loopback
    /^10\./,                            // RFC 1918
    /^172\.(1[6-9]|2\d|3[01])\./,      // RFC 1918
    /^192\.168\./,                      // RFC 1918
    /^169\.254\./,                      // link-local (AWS metadata at 169.254.169.254)
    /^0\./,                             // "this" network
    /^::1$/,                            // IPv6 loopback
    /^fc[0-9a-f]{2}:/i,                 // IPv6 unique local
    /^fe[89ab][0-9a-f]:/i,             // IPv6 link-local
  ].some((pattern) => pattern.test(ip));
}

/**
 * Resolves the URL's hostname via DNS and rejects if it maps to a private IP.
 * Prevents SSRF attacks where attacker.com resolves to 127.0.0.1, etc.
 * Throws if the hostname resolves to a private/reserved address.
 */
async function assertPublicUrl(rawUrl: string): Promise<void> {
  const { hostname } = new URL(rawUrl);

  // Reject obvious private hostnames without DNS lookup
  if (hostname === "localhost" || isPrivateIp(hostname)) {
    throw new Error("URL must point to a public internet address.");
  }

  // Resolve via DNS — catches aliases like attacker.com → 192.168.1.1
  let address: string;
  try {
    ({ address } = await dns.lookup(hostname));
  } catch {
    throw new Error("Could not resolve URL hostname.");
  }
  if (isPrivateIp(address)) {
    throw new Error("URL must point to a public internet address.");
  }
}

/**
 * Fetches a URL and strips HTML to plain text.
 * Streams the response and stops reading after MAX_HTML_FETCH_BYTES to avoid
 * loading huge pages into memory. Removes script/style tags, decodes common
 * entities, and collapses whitespace. Timeout: 10 seconds.
 */
async function extractFromUrl(url: string): Promise<JdExtractResult> {
  // SSRF guard — resolve hostname and reject private IPs before fetching
  await assertPublicUrl(url);

  const response = await fetch(url, {
    headers: { "User-Agent": "JobFitPro/1.0 (resume-optimizer)" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch URL: HTTP ${response.status}`);
  }

  // Stream response — stop reading once we hit MAX_HTML_FETCH_BYTES
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Response body is not readable.");

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.length;
    chunks.push(value);
    if (totalBytes >= MAX_HTML_FETCH_BYTES) {
      await reader.cancel(); // stop downloading — we have enough
      break;
    }
  }
  const html = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");

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
