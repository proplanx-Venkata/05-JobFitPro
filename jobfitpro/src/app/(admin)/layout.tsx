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
      <nav className="bg-neutral-900 text-white px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-y-2">
        <div className="flex items-center gap-4 md:gap-6">
          <span className="font-semibold text-xs md:text-sm tracking-wide text-neutral-300 uppercase">
            Admin
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
            href="/admin/usage"
            className="text-sm text-neutral-300 hover:text-white transition-colors"
          >
            Usage
          </Link>
          <Link
            href="/admin/settings"
            className="text-sm text-neutral-300 hover:text-white transition-colors"
          >
            Settings
          </Link>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <span className="hidden sm:inline text-xs text-neutral-400 truncate max-w-[160px]">
            {user.email}
          </span>
          <Link
            href="/dashboard"
            className="text-xs text-neutral-400 hover:text-white transition-colors"
          >
            ← App
          </Link>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">{children}</main>
    </div>
  );
}
