import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSystemSetting } from "@/lib/admin/get-setting";
import { Card, CardContent } from "@/components/ui/card";
import { Users, FileText, Briefcase, BookOpen, Mail } from "lucide-react";

export default async function AdminStatsPage() {
  const admin = createSupabaseAdminClient();

  const [
    { count: users },
    { count: resumes },
    { count: jds },
    { count: versions },
    { count: coverLetters },
    signupEnabled,
    freeLimit,
    paidLimit,
  ] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("resumes").select("*", { count: "exact", head: true }),
    admin.from("job_descriptions").select("*", { count: "exact", head: true }),
    admin.from("resume_versions").select("*", { count: "exact", head: true }),
    admin.from("cover_letters").select("*", { count: "exact", head: true }),
    getSystemSetting("signup_enabled"),
    getSystemSetting("quota_free_limit"),
    getSystemSetting("quota_paid_monthly_limit"),
  ]);

  const statCards = [
    { label: "Total Users", value: users ?? 0, icon: Users },
    { label: "Resumes Uploaded", value: resumes ?? 0, icon: FileText },
    { label: "Job Descriptions", value: jds ?? 0, icon: Briefcase },
    { label: "Tailored Resumes", value: versions ?? 0, icon: BookOpen },
    { label: "Cover Letters", value: coverLetters ?? 0, icon: Mail },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Platform overview for JobFit Pro alpha.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="pt-6 flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* System settings summary */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-sm font-semibold mb-4">Current System Settings</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">Signups</p>
              <p className="font-semibold">
                {signupEnabled === true ? (
                  <span className="text-green-600">Open</span>
                ) : (
                  <span className="text-red-600">Closed</span>
                )}
              </p>
            </div>
            <div className="rounded-lg border px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">Free tier limit</p>
              <p className="font-semibold">
                {typeof freeLimit === "number" ? freeLimit : "—"} versions total
              </p>
            </div>
            <div className="rounded-lg border px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">Paid tier limit</p>
              <p className="font-semibold">
                {typeof paidLimit === "number" ? paidLimit : "—"} versions / month
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
