import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ApiResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// POST /api/admin/users/create
// Admin-only: creates a new user and profile.
// Body: { email, password, full_name?, tier? }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  // Admin auth check via middleware (email in ADMIN_EMAILS)
  // The middleware already blocks non-admins from /api/admin/* routes.

  let body: {
    email?: string;
    password?: string;
    full_name?: string;
    tier?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Request body must be JSON." },
      { status: 400 }
    );
  }

  const { email, password, full_name, tier } = body;

  // Validate
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "A valid email is required." },
      { status: 400 }
    );
  }
  if (!password || password.length < 8) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }
  if (tier && tier !== "free" && tier !== "paid") {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "tier must be 'free' or 'paid'." },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();

  // Create user in Supabase Auth (email auto-confirmed)
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authErr) {
    const isDuplicate =
      authErr.message?.toLowerCase().includes("already") ||
      authErr.message?.toLowerCase().includes("duplicate") ||
      authErr.status === 422;
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: isDuplicate ? "A user with this email already exists." : authErr.message },
      { status: isDuplicate ? 409 : 500 }
    );
  }

  const newUser = authData.user;

  // Upsert profile
  const { error: profileErr } = await admin.from("profiles").upsert({
    id: newUser.id,
    email,
    full_name: full_name ?? null,
    tier: (tier ?? "free") as "free" | "paid",
    monthly_reset_at: new Date().toISOString(),
  });

  if (profileErr) {
    // Don't block — user auth was created, profile can be fixed later
    console.error("Profile upsert failed:", profileErr.message);
  }

  return NextResponse.json<ApiResponse<{ email: string; password: string }>>(
    { success: true, data: { email, password } },
    { status: 201 }
  );
}
