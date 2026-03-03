import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ApiResponse } from "@/types/api";

export interface UsageUser {
  userId: string;
  email: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  storageBytes: number;
  operationCounts: Record<string, number>;
}

export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  storageBytes: number;
}

export interface UsageResponse {
  dateRange: { from: string; to: string };
  inputCostPerMillion: number;
  outputCostPerMillion: number;
  users: UsageUser[];
  totals: UsageTotals;
}

// ---------------------------------------------------------------------------
// GET /api/admin/usage?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns AI token usage and estimated cost per user within the date range.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Default: first of current month → today
  const now = new Date();
  const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
  const defaultTo = now.toISOString().slice(0, 10);

  const from = searchParams.get("from") ?? defaultFrom;
  const to = searchParams.get("to") ?? defaultTo;

  // to is inclusive — extend to end of day
  const toEndOfDay = `${to}T23:59:59.999Z`;

  const admin = createSupabaseAdminClient();

  // ── 1. Read pricing from system_settings ─────────────────────────────────
  const { data: settingsRows } = await admin
    .from("system_settings")
    .select("key, value")
    .in("key", ["ai_cost_input_per_million", "ai_cost_output_per_million"]);

  const settingsMap = Object.fromEntries(
    (settingsRows ?? []).map((r) => [r.key, r.value])
  );
  const inputCostPerMillion =
    typeof settingsMap["ai_cost_input_per_million"] === "number"
      ? (settingsMap["ai_cost_input_per_million"] as number)
      : 0;
  const outputCostPerMillion =
    typeof settingsMap["ai_cost_output_per_million"] === "number"
      ? (settingsMap["ai_cost_output_per_million"] as number)
      : 0;

  // ── 2. Query ai_usage_logs within date range ──────────────────────────────
  const { data: logs, error: logsError } = await admin
    .from("ai_usage_logs")
    .select("user_id, operation, input_tokens, output_tokens")
    .gte("created_at", `${from}T00:00:00.000Z`)
    .lte("created_at", toEndOfDay);

  if (logsError) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: logsError.message },
      { status: 500 }
    );
  }

  // ── 3. Aggregate per user ─────────────────────────────────────────────────
  const userMap = new Map<
    string,
    { inputTokens: number; outputTokens: number; operationCounts: Record<string, number> }
  >();

  for (const log of logs ?? []) {
    if (!userMap.has(log.user_id)) {
      userMap.set(log.user_id, { inputTokens: 0, outputTokens: 0, operationCounts: {} });
    }
    const agg = userMap.get(log.user_id)!;
    agg.inputTokens += log.input_tokens;
    agg.outputTokens += log.output_tokens;
    agg.operationCounts[log.operation] = (agg.operationCounts[log.operation] ?? 0) + 1;
  }

  if (userMap.size === 0) {
    return NextResponse.json<ApiResponse<UsageResponse>>({
      success: true,
      data: {
        dateRange: { from, to },
        inputCostPerMillion,
        outputCostPerMillion,
        users: [],
        totals: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0, storageBytes: 0 },
      },
    });
  }

  // ── 4. Fetch profiles for emails ──────────────────────────────────────────
  const userIds = Array.from(userMap.keys());
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email")
    .in("id", userIds);

  const emailMap = new Map<string, string>(
    (profiles ?? []).map((p) => [p.id, p.email])
  );

  // ── 5. Fetch storage bytes per user (RPC) ─────────────────────────────────
  const storageMap = new Map<string, number>();
  await Promise.all(
    userIds.map(async (uid) => {
      const { data } = await admin.rpc("get_user_storage_bytes", { p_user_id: uid });
      storageMap.set(uid, typeof data === "number" ? data : 0);
    })
  );

  // ── 6. Build response ─────────────────────────────────────────────────────
  const users: UsageUser[] = [];
  const totals: UsageTotals = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
    storageBytes: 0,
  };

  for (const [userId, agg] of userMap.entries()) {
    const totalTokens = agg.inputTokens + agg.outputTokens;
    const estimatedCostUsd =
      (agg.inputTokens / 1_000_000) * inputCostPerMillion +
      (agg.outputTokens / 1_000_000) * outputCostPerMillion;
    const storageBytes = storageMap.get(userId) ?? 0;

    users.push({
      userId,
      email: emailMap.get(userId) ?? userId,
      inputTokens: agg.inputTokens,
      outputTokens: agg.outputTokens,
      totalTokens,
      estimatedCostUsd,
      storageBytes,
      operationCounts: agg.operationCounts,
    });

    totals.inputTokens += agg.inputTokens;
    totals.outputTokens += agg.outputTokens;
    totals.totalTokens += totalTokens;
    totals.estimatedCostUsd += estimatedCostUsd;
    totals.storageBytes += storageBytes;
  }

  // Sort by total tokens desc
  users.sort((a, b) => b.totalTokens - a.totalTokens);

  return NextResponse.json<ApiResponse<UsageResponse>>({
    success: true,
    data: {
      dateRange: { from, to },
      inputCostPerMillion,
      outputCostPerMillion,
      users,
      totals,
    },
  });
}
