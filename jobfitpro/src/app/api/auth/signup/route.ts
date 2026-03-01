import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SignupRequest, ApiResponse, AuthResponse } from "@/types/api";

/**
 * POST /api/auth/signup
 * Body: { email, password, full_name? }
 *
 * Creates a new Supabase auth user. The `handle_new_user` DB trigger
 * automatically inserts a row into public.profiles.
 */
export async function POST(request: NextRequest) {
  try {
    const body: SignupRequest = await request.json();
    const { email, password, full_name } = body;

    if (!email || !password) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: full_name ?? "" },
      },
    });

    if (error) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json<ApiResponse<AuthResponse>>(
      { success: true, data: { user: data.user, session: data.session } },
      { status: 201 }
    );
  } catch {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }
}
