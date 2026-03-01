import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateResumeDocx } from "@/lib/resume/generate-docx";
import type { ParsedResume } from "@/types/resume";

// ---------------------------------------------------------------------------
// GET /api/resume-versions/[id]/docx
// Generates and streams a DOCX file for the rewritten resume version.
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

  const { data: version, error } = await supabase
    .from("resume_versions")
    .select("rewritten_content, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !version) {
    return NextResponse.json({ error: "Resume version not found." }, { status: 404 });
  }

  if (!version.rewritten_content) {
    return NextResponse.json(
      { error: "Rewritten content not available. Generate the resume first." },
      { status: 422 }
    );
  }

  let docxBuffer: Buffer;
  try {
    docxBuffer = await generateResumeDocx(version.rewritten_content as unknown as ParsedResume);
  } catch {
    return NextResponse.json({ error: "DOCX generation failed." }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(docxBuffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": 'attachment; filename="resume.docx"',
      "Content-Length": String(docxBuffer.length),
    },
  });
}
