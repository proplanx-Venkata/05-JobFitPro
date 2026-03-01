import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { extractText } from "@/lib/resume/extract-text";
import {
  validateMimeType,
  validateFileSize,
  validatePageCount,
  validateExtractedText,
} from "@/lib/resume/validate";
import { parseResumeWithClaude } from "@/lib/resume/parse-with-claude";
import type { ApiResponse } from "@/types/api";
import type { Database } from "@/types/database";

type ResumeRow = Database["public"]["Tables"]["resumes"]["Row"];
type ResumeListRow = Omit<ResumeRow, "parsed_content">;

// Allow up to 60 s for Claude to parse — needed for Vercel deployments
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// POST /api/resumes
// Upload a PDF/DOCX resume, validate it, parse it with Claude, and store it.
// If the user already has an active resume it is soft-deleted first.
// Body: multipart/form-data with a "file" field.
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
  if (!file) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: 'No file provided — use form field name "file".' },
      { status: 400 }
    );
  }

  // ── 2. Validate type + size ──────────────────────────────────────────────
  const typeCheck = validateMimeType(file.type);
  if (!typeCheck.valid) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: typeCheck.error! },
      { status: 422 }
    );
  }

  const sizeCheck = validateFileSize(file.size);
  if (!sizeCheck.valid) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: sizeCheck.error! },
      { status: 422 }
    );
  }

  // ── 3. Read buffer + extract text ────────────────────────────────────────
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  let extracted: { text: string; pageCount: number };
  try {
    extracted = await extractText(buffer, file.type);
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

  // ── 4. Validate page count + text quality ────────────────────────────────
  const pageCheck = validatePageCount(extracted.pageCount);
  if (!pageCheck.valid) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: pageCheck.error! },
      { status: 422 }
    );
  }

  const textCheck = validateExtractedText(extracted.text);
  if (!textCheck.valid) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: textCheck.error! },
      { status: 422 }
    );
  }

  // ── 5. Soft-delete existing active resume ────────────────────────────────
  await supabase
    .from("resumes")
    .update({ is_active: false, replaced_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("is_active", true);

  // ── 6. Insert resume record (status = uploading) ─────────────────────────
  const { data: record, error: insertError } = await supabase
    .from("resumes")
    .insert({
      user_id: user.id,
      storage_path: "", // filled in after upload
      original_filename: file.name,
      file_size_bytes: file.size,
      mime_type: file.type,
      page_count: extracted.pageCount,
      status: "uploading",
    })
    .select()
    .single();

  if (insertError || !record) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Failed to create resume record." },
      { status: 500 }
    );
  }

  // ── 7. Upload to storage ─────────────────────────────────────────────────
  // Path: resumes/{user_id}/{resume_id}/{filename}
  const storagePath = `${user.id}/${record.id}/${file.name}`;
  const admin = createSupabaseAdminClient();

  const { error: uploadError } = await admin.storage
    .from("resumes")
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    await supabase.from("resumes").delete().eq("id", record.id);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Failed to upload file to storage." },
      { status: 500 }
    );
  }

  await supabase
    .from("resumes")
    .update({ storage_path: storagePath, status: "processing" })
    .eq("id", record.id);

  // ── 8. Parse with Claude ─────────────────────────────────────────────────
  let parsedContent;
  try {
    parsedContent = await parseResumeWithClaude(extracted.text);
  } catch {
    await supabase
      .from("resumes")
      .update({ status: "error" })
      .eq("id", record.id);
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: "AI parsing failed. Please try again.",
      },
      { status: 500 }
    );
  }

  // ── 9. Save parsed content ───────────────────────────────────────────────
  const { data: final, error: updateError } = await supabase
    .from("resumes")
    .update({
      status: "ready",
      parsed_content: parsedContent as unknown as import("@/types/database").Json,
      parsed_at: new Date().toISOString(),
    })
    .eq("id", record.id)
    .select()
    .single();

  if (updateError || !final) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Failed to save parsed content." },
      { status: 500 }
    );
  }

  return NextResponse.json<ApiResponse<ResumeRow>>(
    { success: true, data: final },
    { status: 201 }
  );
}

// ---------------------------------------------------------------------------
// GET /api/resumes
// Returns all resumes for the authenticated user (newest first).
// parsed_content is excluded — use GET /api/resumes/active for full detail.
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
    .from("resumes")
    .select(
      "id, original_filename, file_size_bytes, mime_type, page_count, status, parsed_at, is_active, replaced_at, created_at, updated_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json<ApiResponse<ResumeListRow[]>>({
    success: true,
    data: (data ?? []) as ResumeListRow[],
  });
}
