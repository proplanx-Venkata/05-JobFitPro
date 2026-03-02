import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!adminEmails.includes((user.email ?? "").toLowerCase())) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Admin top nav */}
      <nav className="bg-neutral-900 text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-sm tracking-wide text-neutral-300 uppercase">
            JobFit Pro — Admin
          </span>
          <Link
            href="/admin"
            className="text-sm text-neutral-300 hover:text-white transition-colors"
          >
            Stats
          </Link>
          <Link
            href="/admin/users"
            className="text-sm text-neutral-300 hover:text-white transition-colors"
          >
            Users
          </Link>
          <Link
            href="/admin/settings"
            className="text-sm text-neutral-300 hover:text-white transition-colors"
          >
            Settings
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-neutral-400">{user.email}</span>
          <Link
            href="/dashboard"
            className="text-xs text-neutral-400 hover:text-white transition-colors"
          >
            Back to App
          </Link>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
