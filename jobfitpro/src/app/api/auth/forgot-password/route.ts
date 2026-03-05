import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ApiResponse } from "@/types/api";

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 *
 * Sends a password reset email. Always returns 200 to prevent email enumeration.
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`;

    // Ignore error — always succeed to avoid email enumeration
    await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    return NextResponse.json<ApiResponse<{ sent: true }>>({
      success: true,
      data: { sent: true },
    });
  } catch {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }
}
