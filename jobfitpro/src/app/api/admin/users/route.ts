import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ApiResponse } from "@/types/api";

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  tier: "free" | "paid";
  monthly_version_count: number;
  monthly_reset_at: string;
  created_at: string;
  total_version_count: number;
}

export async function GET() {
  const admin = createSupabaseAdminClient();

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, email, full_name, tier, monthly_version_count, monthly_reset_at, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  // Fetch total version counts for all users in parallel
  let usersWithCounts: AdminUser[];
  try {
    usersWithCounts = await Promise.all(
      (profiles ?? []).map(async (profile) => {
        const { data: count } = await admin.rpc("get_user_version_count", {
          p_user_id: profile.id,
        });
        return { ...profile, total_version_count: count ?? 0 } as AdminUser;
      })
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch user counts";
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: message },
      { status: 500 }
    );
  }

  return NextResponse.json<ApiResponse<AdminUser[]>>({
    success: true,
    data: usersWithCounts,
  });
}
