import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { LoginRequest, ApiResponse, AuthResponse } from "@/types/api";

/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * Authenticates the user and sets auth cookies via the SSR client.
 */
export async function POST(request: NextRequest) {
  try {
    const body: LoginRequest = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: error.message },
        { status: 401 }
      );
    }

    return NextResponse.json<ApiResponse<AuthResponse>>({
      success: true,
      data: { user: data.user, session: data.session },
    });
  } catch {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }
}
