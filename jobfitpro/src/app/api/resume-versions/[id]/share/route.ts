import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ApiResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// POST /api/resume-versions/[id]/share
// Creates (or updates PIN for) a shareable link for a ready resume version.
//
// Body (JSON): { pin: string }  — exactly 6 digits
// Returns: { shareUrl: string }
// ---------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  let body: { pin?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Request body must be JSON." },
      { status: 400 }
    );
  }

  const { pin } = body;
  if (!pin || !/^\d{6}$/.test(pin)) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "PIN must be exactly 6 digits." },
      { status: 400 }
    );
  }

  // Fetch resume_version (must be ready, must belong to user)
  const { data: version, error: vErr } = await supabase
    .from("resume_versions")
    .select("id, status, share_token")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (vErr || !version) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Resume version not found." },
      { status: 404 }
    );
  }
  if (version.status !== "ready") {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Resume version must be ready before sharing." },
      { status: 422 }
    );
  }

  const adminClient = createSupabaseAdminClient();
  let token = version.share_token;

  if (token) {
    // Update only the PIN (keep existing token)
    await adminClient
      .from("resume_versions")
      .update({ share_pin: pin })
      .eq("id", id);
  } else {
    // Generate new token
    token = crypto.randomUUID();
    await adminClient
      .from("resume_versions")
      .update({ share_token: token, share_pin: pin })
      .eq("id", id);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return NextResponse.json<ApiResponse<{ shareUrl: string }>>(
    { success: true, data: { shareUrl: `${appUrl}/share/${token}` } },
    { status: 200 }
  );
}
