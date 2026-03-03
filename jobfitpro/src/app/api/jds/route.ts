import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { extractJdText } from "@/lib/jd/extract-text";
import {
  validateJdMimeType,
  validateJdFileSize,
  validateJdPageCount,
  validateJdText,
  validateJdTextSize,
  validateUrl,
  URL_TEXT_LIMIT_BYTES,
} from "@/lib/jd/validate";
import { cleanJdWithClaude } from "@/lib/jd/clean-with-claude";
import { logAiUsage } from "@/lib/ai/log-usage";
import type { ApiResponse } from "@/types/api";
import type { Database } from "@/types/database";

type JdRow = Database["public"]["Tables"]["job_descriptions"]["Row"];
type JdListRow = Omit<JdRow, "raw_text" | "cleaned_text">;

// Allow up to 30 s for fetch + Claude on Vercel
export const maxDuration = 30;

// ---------------------------------------------------------------------------
// POST /api/jds
// Ingest a job description from a PDF/DOCX file or a URL.
// Accepts multipart/form-data with either:
//   - "file" field (PDF or DOCX), or
//   - "url"  field (http/https URL to scrape)
// Strips boilerplate with Claude, stores the result, returns the JD record.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // ── 1. Parse multipart form ──────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Invalid form data." },
      { status: 400 }
    );
  }

  const file = formData.get("file") as File | null;
  const urlField = formData.get("url") as string | null;

  if (!file && !urlField) {
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: 'Provide either a "file" (PDF/DOCX) or a "url" field.',
      },
      { status: 400 }
    );
  }

  // ── 2a. File path ────────────────────────────────────────────────────────
  if (file) {
    const typeCheck = validateJdMimeType(file.type);
    if (!typeCheck.valid) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: typeCheck.error! },
        { status: 422 }
      );
    }

    const sizeCheck = validateJdFileSize(file.size);
    if (!sizeCheck.valid) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: sizeCheck.error! },
        { status: 422 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const sourceType = file.type === "application/pdf" ? "pdf" : "docx";

    let extracted: { text: string; pageCount: number | null; sizeBytes: number };
    try {
      extracted = await extractJdText({ type: sourceType, buffer });
    } catch {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error:
            "Could not read file content. The file may be corrupt or password-protected.",
        },
        { status: 422 }
      );
    }

    if (extracted.pageCount !== null) {
      const pageCheck = validateJdPageCount(extracted.pageCount);
      if (!pageCheck.valid) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: pageCheck.error! },
          { status: 422 }
        );
      }
    }

    const textCheck = validateJdText(extracted.text);
    if (!textCheck.valid) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: textCheck.error! },
        { status: 422 }
      );
    }

    return ingestJd({
      supabase,
      userId: user.id,
      sourceType,
      rawText: extracted.text,
      pageCount: extracted.pageCount,
      textSizeBytes: extracted.sizeBytes,
      file,
      buffer,
    });
  }

  // ── 2b. URL path ─────────────────────────────────────────────────────────
  const urlCheck = validateUrl(urlField!);
  if (!urlCheck.valid) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: urlCheck.error! },
      { status: 422 }
    );
  }

  let extracted: { text: string; pageCount: number | null; sizeBytes: number };
  try {
    extracted = await extractJdText({ type: "url", url: urlField! });
  } catch (err) {
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "Failed to fetch the URL. Please check the link and try again.",
      },
      { status: 422 }
    );
  }

  // Truncate oversized URL text to the 50 KB limit before sending to Claude
  let { text: rawText } = extracted;
  if (extracted.sizeBytes > URL_TEXT_LIMIT_BYTES) {
    rawText = Buffer.from(rawText, "utf8")
      .subarray(0, URL_TEXT_LIMIT_BYTES)
      .toString("utf8");
  }

  const textCheck = validateJdText(rawText);
  if (!textCheck.valid) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: textCheck.error! },
      { status: 422 }
    );
  }

  return ingestJd({
    supabase,
    userId: user.id,
    sourceType: "url",
    rawText,
    pageCount: null,
    textSizeBytes: Buffer.byteLength(rawText, "utf8"),
    sourceUrl: urlField!,
  });
}

// ---------------------------------------------------------------------------
// Shared ingestion logic — called after source-specific validation
// ---------------------------------------------------------------------------
async function ingestJd(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  sourceType: "pdf" | "docx" | "url";
  rawText: string;
  pageCount: number | null;
  textSizeBytes: number;
  sourceUrl?: string;
  file?: File;
  buffer?: Buffer;
}): Promise<NextResponse> {
  const {
    supabase,
    userId,
    sourceType,
    rawText,
    pageCount,
    textSizeBytes,
    sourceUrl,
    file,
    buffer,
  } = params;

  // ── 3. Clean with Claude ─────────────────────────────────────────────────
  let cleaned: { title: string | null; company: string | null; cleaned_text: string };
  try {
    const { data, inputTokens, outputTokens } = await cleanJdWithClaude(rawText);
    cleaned = data;
    logAiUsage({ userId, operation: "jd_clean", inputTokens, outputTokens, model: "claude-haiku-4-5-20251001" });
  } catch {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "AI cleanup failed. Please try again." },
      { status: 500 }
    );
  }

  // ── 4. Insert JD record ──────────────────────────────────────────────────
  const { data: record, error: insertError } = await supabase
    .from("job_descriptions")
    .insert({
      user_id: userId,
      title: cleaned.title,
      company: cleaned.company,
      source_type: sourceType,
      source_url: sourceUrl ?? null,
      raw_text: rawText,
      cleaned_text: cleaned.cleaned_text,
      page_count: pageCount,
      text_size_bytes: textSizeBytes,
    })
    .select()
    .single();

  if (insertError || !record) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Failed to save job description." },
      { status: 500 }
    );
  }

  // ── 5. Upload file to storage (file sources only) ────────────────────────
  if (file && buffer) {
    const storagePath = `${userId}/${record.id}/${file.name}`;
    const admin = createSupabaseAdminClient();

    const { error: uploadError } = await admin.storage
      .from("job-descriptions")
      .upload(storagePath, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      // Non-fatal: delete the orphaned record and return error
      await supabase.from("job_descriptions").delete().eq("id", record.id);
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to upload file to storage." },
        { status: 500 }
      );
    }

    await supabase
      .from("job_descriptions")
      .update({ storage_path: storagePath })
      .eq("id", record.id);

    record.storage_path = storagePath;
  }

  return NextResponse.json<ApiResponse<JdRow>>(
    { success: true, data: record },
    { status: 201 }
  );
}

// ---------------------------------------------------------------------------
// GET /api/jds
// Returns all JDs for the authenticated user (newest first).
// raw_text and cleaned_text are excluded — use GET /api/jds/[id] for full detail.
// ---------------------------------------------------------------------------
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { data, error } = await supabase
    .from("job_descriptions")
    .select(
      "id, user_id, title, company, source_type, storage_path, source_url, page_count, text_size_bytes, created_at, updated_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json<ApiResponse<JdListRow[]>>({
    success: true,
    data: (data ?? []) as JdListRow[],
  });
}
