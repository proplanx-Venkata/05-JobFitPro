import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ApiResponse } from "@/types/api";

/**
 * POST /api/auth/logout
 *
 * Signs out the current user and clears auth cookies.
 */
export async function POST() {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json<ApiResponse<{ success: true }>>({
    success: true,
    data: { success: true },
  });
}
