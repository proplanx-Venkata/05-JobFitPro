import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ApiResponse } from "@/types/api";

type Action = "set_tier" | "reset_quota";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { action?: Action; tier?: "free" | "paid" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Invalid request body." },
      { status: 400 }
    );
  }

  const { action, tier } = body;
  if (!action || !["set_tier", "reset_quota"].includes(action)) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "action must be set_tier or reset_quota." },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();

  if (action === "set_tier") {
    if (!tier || !["free", "paid"].includes(tier)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "tier must be free or paid." },
        { status: 400 }
      );
    }
    const { error } = await admin
      .from("profiles")
      .update({ tier })
      .eq("id", id);
    if (error) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
  } else {
    // reset_quota
    const { error } = await admin
      .from("profiles")
      .update({ monthly_version_count: 0 })
      .eq("id", id);
    if (error) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json<ApiResponse<{ ok: boolean }>>({
    success: true,
    data: { ok: true },
  });
}
