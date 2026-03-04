import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { UserTierButton } from "@/components/admin/user-tier-button";
import { CreateUserDialog } from "@/components/admin/create-user-dialog";

interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  tier: "free" | "paid";
  monthly_version_count: number;
  monthly_reset_at: string;
  created_at: string;
  total_version_count: number;
}

export default async function AdminUsersPage() {
  const admin = createSupabaseAdminClient();

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, full_name, tier, monthly_version_count, monthly_reset_at, created_at")
    .order("created_at", { ascending: false });

  const users: AdminUser[] = await Promise.all(
    (profiles ?? []).map(async (p) => {
      const { data: count } = await admin.rpc("get_user_version_count", {
        p_user_id: p.id,
      });
      return { ...p, total_version_count: count ?? 0 } as AdminUser;
    })
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {users.length} registered user{users.length !== 1 ? "s" : ""}.
          </p>
        </div>
        <CreateUserDialog />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b bg-neutral-50">
                  <th className="text-left py-3 px-4 font-medium">Email</th>
                  <th className="text-left py-3 px-4 font-medium">Name</th>
                  <th className="text-left py-3 px-4 font-medium">Tier</th>
                  <th className="text-right py-3 px-4 font-medium">Versions (total)</th>
                  <th className="text-right py-3 px-4 font-medium">Monthly used</th>
                  <th className="text-left py-3 px-4 font-medium">Joined</th>
                  <th className="text-right py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-neutral-50/50">
                    <td className="py-3 px-4 font-mono text-xs">{u.email}</td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {u.full_name ?? "—"}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.tier === "paid"
                            ? "bg-green-100 text-green-700"
                            : "bg-neutral-100 text-neutral-600"
                        }`}
                      >
                        {u.tier}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      {u.total_version_count}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      {u.monthly_version_count}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <UserTierButton
                        userId={u.id}
                        currentTier={u.tier}
                        monthlyCount={u.monthly_version_count}
                      />
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-8 text-center text-muted-foreground text-sm"
                    >
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
