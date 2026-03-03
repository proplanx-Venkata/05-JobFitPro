import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import type { UsageResponse } from "@/app/api/admin/usage/route";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCost(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(6)}`;
  return `$${usd.toFixed(4)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function AdminUsagePage({ searchParams }: PageProps) {
  const params = await searchParams;

  const now = new Date();
  const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
  const defaultTo = now.toISOString().slice(0, 10);

  const from = params.from ?? defaultFrom;
  const to = params.to ?? defaultTo;

  // Fetch data directly (server component — no fetch overhead)
  const admin = createSupabaseAdminClient();

  const toEndOfDay = `${to}T23:59:59.999Z`;

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

  const { data: logs } = await admin
    .from("ai_usage_logs")
    .select("user_id, operation, input_tokens, output_tokens")
    .gte("created_at", `${from}T00:00:00.000Z`)
    .lte("created_at", toEndOfDay);

  // Aggregate
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

  const userIds = Array.from(userMap.keys());

  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id, email").in("id", userIds)
    : { data: [] };

  const emailMap = new Map<string, string>(
    (profiles ?? []).map((p) => [p.id, p.email])
  );

  const storageMap = new Map<string, number>();
  if (userIds.length) {
    await Promise.all(
      userIds.map(async (uid) => {
        const { data } = await admin.rpc("get_user_storage_bytes", { p_user_id: uid });
        storageMap.set(uid, typeof data === "number" ? data : 0);
      })
    );
  }

  type UserRow = UsageResponse["users"][number];
  const users: UserRow[] = [];
  let totalInput = 0, totalOutput = 0, totalCost = 0, totalStorage = 0;

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

    totalInput += agg.inputTokens;
    totalOutput += agg.outputTokens;
    totalCost += estimatedCostUsd;
    totalStorage += storageBytes;
  }
  users.sort((a, b) => b.totalTokens - a.totalTokens);

  const totalTokens = totalInput + totalOutput;

  // First log date (for the note)
  const { data: firstLog } = await admin
    .from("ai_usage_logs")
    .select("created_at")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usage</h1>
        <p className="text-muted-foreground text-sm mt-1">
          AI token usage and estimated cost by user.
        </p>
      </div>

      {/* Date range filter */}
      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs font-medium block mb-1">From</label>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="h-8 rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">To</label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="h-8 rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <button
          type="submit"
          className="h-8 px-4 rounded-md bg-neutral-900 text-white text-sm hover:bg-neutral-700 transition-colors"
        >
          Apply
        </button>
      </form>

      {/* Pricing note */}
      <p className="text-xs text-muted-foreground">
        Cost at ${inputCostPerMillion}/M input · ${outputCostPerMillion}/M output —{" "}
        <a href="/admin/settings" className="underline hover:text-foreground">
          update in Settings
        </a>
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Total Tokens</p>
            <p className="text-2xl font-bold">{formatTokens(totalTokens)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatTokens(totalInput)} in · {formatTokens(totalOutput)} out
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Est. Cost</p>
            <p className="text-2xl font-bold">{formatCost(totalCost)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {users.length} active user{users.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Total Storage</p>
            <p className="text-2xl font-bold">{formatBytes(totalStorage)}</p>
            <p className="text-xs text-muted-foreground mt-1">across all buckets</p>
          </CardContent>
        </Card>
      </div>

      {/* User table */}
      {users.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No usage data for the selected date range.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-neutral-50 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium text-right">Input Tokens</th>
                <th className="px-4 py-3 font-medium text-right">Output Tokens</th>
                <th className="px-4 py-3 font-medium text-right">Est. Cost</th>
                <th className="px-4 py-3 font-medium text-right">Storage</th>
                <th className="px-4 py-3 font-medium">Top Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => {
                const topOps = Object.entries(u.operationCounts)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 3)
                  .map(([op, count]) => `${op}×${count}`)
                  .join(", ");
                return (
                  <tr key={u.userId} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs truncate max-w-[200px]">
                      {u.email}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatTokens(u.inputTokens)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatTokens(u.outputTokens)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCost(u.estimatedCostUsd)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatBytes(u.storageBytes)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{topOps}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-neutral-50 font-semibold text-xs">
                <td className="px-4 py-3">Totals</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatTokens(totalInput)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatTokens(totalOutput)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatCost(totalCost)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatBytes(totalStorage)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {firstLog && (
        <p className="text-xs text-muted-foreground">
          Token tracking started{" "}
          {new Date(firstLog.created_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
          . Historical data before that date is not available.
        </p>
      )}
    </div>
  );
}
