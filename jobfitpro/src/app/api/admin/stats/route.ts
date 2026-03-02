import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ApiResponse } from "@/types/api";

// Middleware already validates admin access for /api/admin/* routes.

export interface AdminStats {
  users: number;
  resumes: number;
  jds: number;
  versions: number;
  coverLetters: number;
}

export async function GET() {
  const admin = createSupabaseAdminClient();

  const [
    { count: users },
    { count: resumes },
    { count: jds },
    { count: versions },
    { count: coverLetters },
  ] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("resumes").select("*", { count: "exact", head: true }),
    admin.from("job_descriptions").select("*", { count: "exact", head: true }),
    admin.from("resume_versions").select("*", { count: "exact", head: true }),
    admin.from("cover_letters").select("*", { count: "exact", head: true }),
  ]);

  return NextResponse.json<ApiResponse<AdminStats>>({
    success: true,
    data: {
      users: users ?? 0,
      resumes: resumes ?? 0,
      jds: jds ?? 0,
      versions: versions ?? 0,
      coverLetters: coverLetters ?? 0,
    },
  });
}
