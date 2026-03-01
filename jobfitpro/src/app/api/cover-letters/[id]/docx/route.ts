import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateCoverLetterDocx } from "@/lib/cover-letter/generate-docx";
import type { CoverLetterContent } from "@/types/cover-letter";
import type { ParsedResume } from "@/types/resume";

// ---------------------------------------------------------------------------
// GET /api/cover-letters/[id]/docx
// Generates and streams a DOCX file for the cover letter.
// ---------------------------------------------------------------------------
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Fetch cover letter ───────────────────────────────────────────────────
  const { data: cl, error: clErr } = await supabase
    .from("cover_letters")
    .select("generated_content, resume_version_id")
    .eq("id", id)
    .single();

  if (clErr || !cl) {
    return NextResponse.json({ error: "Cover letter not found." }, { status: 404 });
  }

  if (!cl.generated_content) {
    return NextResponse.json(
      { error: "Cover letter content not available." },
      { status: 422 }
    );
  }

  // ── Verify ownership via resume_version ──────────────────────────────────
  const { data: version, error: vErr } = await supabase
    .from("resume_versions")
    .select("rewritten_content, resume_id, job_description_id")
    .eq("id", cl.resume_version_id)
    .eq("user_id", user.id)
    .single();

  if (vErr || !version) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Fetch master resume for contact header ────────────────────────────────
  let parsedContent: ParsedResume | null = null;
  if (version.rewritten_content) {
    parsedContent = version.rewritten_content as unknown as ParsedResume;
  } else {
    const { data: resume } = await supabase
      .from("resumes")
      .select("parsed_content")
      .eq("id", version.resume_id)
      .eq("user_id", user.id)
      .single();
    if (resume?.parsed_content) {
      parsedContent = resume.parsed_content as unknown as ParsedResume;
    }
  }

  if (!parsedContent) {
    return NextResponse.json({ error: "Resume data not available." }, { status: 422 });
  }

  // ── Fetch JD for addressee block ─────────────────────────────────────────
  const { data: jd } = await supabase
    .from("job_descriptions")
    .select("title, company")
    .eq("id", version.job_description_id)
    .eq("user_id", user.id)
    .single();

  let docxBuffer: Buffer;
  try {
    docxBuffer = await generateCoverLetterDocx(
      cl.generated_content as unknown as CoverLetterContent,
      parsedContent,
      jd?.company ?? null,
      jd?.title ?? null
    );
  } catch {
    return NextResponse.json({ error: "DOCX generation failed." }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(docxBuffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": 'attachment; filename="cover_letter.docx"',
      "Content-Length": String(docxBuffer.length),
    },
  });
}
