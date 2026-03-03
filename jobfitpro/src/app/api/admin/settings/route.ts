import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ApiResponse } from "@/types/api";
import type { Json } from "@/types/database";

export interface SystemSetting {
  key: string;
  value: Json;
  updated_at: string;
}

export async function GET() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("system_settings")
    .select("key, value, updated_at")
    .order("key");

  if (error) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json<ApiResponse<SystemSetting[]>>({
    success: true,
    data: data ?? [],
  });
}

const ALLOWED_SETTINGS_KEYS = [
  "signup_enabled",
  "quota_free_limit",
  "quota_paid_monthly_limit",
  "ai_cost_input_per_million",
  "ai_cost_output_per_million",
] as const;

export async function PATCH(request: NextRequest) {
  let body: { key?: string; value?: Json };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Invalid request body." },
      { status: 400 }
    );
  }

  const { key, value } = body;
  if (!key || value === undefined) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "key and value are required." },
      { status: 400 }
    );
  }

  if (!(ALLOWED_SETTINGS_KEYS as readonly string[]).includes(key)) {
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: `Invalid key "${key}". Allowed keys: ${ALLOWED_SETTINGS_KEYS.join(", ")}.`,
      },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("system_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() })
    .select("key, value, updated_at")
    .single();

  if (error) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json<ApiResponse<SystemSetting>>({
    success: true,
    data: data,
  });
}
