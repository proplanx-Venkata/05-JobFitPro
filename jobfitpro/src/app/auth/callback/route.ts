import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /auth/callback
 * Exchanges the Supabase PKCE code for a session (server-side).
 * Used by password reset and OAuth flows.
 * ?code=<code>&next=<path>
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Code missing or exchange failed — send back to forgot-password with error flag
  return NextResponse.redirect(`${origin}/forgot-password?error=invalid_link`);
}
