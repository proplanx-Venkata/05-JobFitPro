import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { SettingsForm } from "@/components/admin/settings-form";

export default async function AdminSettingsPage() {
  const admin = createSupabaseAdminClient();
  const { data: rows } = await admin
    .from("system_settings")
    .select("key, value");

  const settings = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]));

  const signupEnabled = settings["signup_enabled"] === true;
  const freeLimit =
    typeof settings["quota_free_limit"] === "number"
      ? (settings["quota_free_limit"] as number)
      : 2;
  const paidLimit =
    typeof settings["quota_paid_monthly_limit"] === "number"
      ? (settings["quota_paid_monthly_limit"] as number)
      : 10;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">System Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Control signup access and quota limits. Changes take effect immediately.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <SettingsForm
            signupEnabled={signupEnabled}
            freeLimit={freeLimit}
            paidLimit={paidLimit}
          />
        </CardContent>
      </Card>
    </div>
  );
}
