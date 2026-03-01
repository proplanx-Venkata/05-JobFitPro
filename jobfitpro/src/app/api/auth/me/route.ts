import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ApiResponse, ProfileResponse } from "@/types/api";

/**
 * GET /api/auth/me
 *
 * Returns the authenticated user and their profile row.
 * Returns 401 if not authenticated.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Profile not found" },
      { status: 404 }
    );
  }

  return NextResponse.json<ApiResponse<ProfileResponse>>({
    success: true,
    data: { user, profile },
  });
}
