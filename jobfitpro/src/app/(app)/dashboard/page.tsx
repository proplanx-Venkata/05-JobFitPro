import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HistoryRow } from "@/components/history/history-row";
import { FileText, Briefcase, CheckCircle, Plus } from "lucide-react";
import type { HistoryEntry } from "@/types/history";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Fetch resume versions
  const { data: versions } = await supabase
    .from("resume_versions")
    .select(
      "id, status, output_filename, output_storage_path, created_at, job_description_id"
    )
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  const history: HistoryEntry[] = [];

  if (versions && versions.length > 0) {
    const versionIds = versions.map((v) => v.id);
    const jdIds = [...new Set(versions.map((v) => v.job_description_id))];

    // 2. Batch fetch related data
    const [jdsRes, interviewsRes, atsRes, clRes] = await Promise.all([
      supabase
        .from("job_descriptions")
        .select("id, title, company, source_type")
        .in("id", jdIds),
      supabase
        .from("interview_sessions")
        .select("id, resume_version_id, status, question_count, completed_at")
        .in("resume_version_id", versionIds),
      supabase
        .from("ats_scores")
        .select(
          "id, resume_version_id, overall_score, category, passes_threshold, created_at"
        )
        .in("resume_version_id", versionIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("cover_letters")
        .select("id, resume_version_id, status, output_storage_path")
        .in("resume_version_id", versionIds),
    ]);

    const jdMap = Object.fromEntries(
      (jdsRes.data ?? []).map((j) => [j.id, j])
    );
    const interviewMap = Object.fromEntries(
      (interviewsRes.data ?? []).map((i) => [i.resume_version_id, i])
    );
    // Keep only latest ATS score per version
    type AtsScoreRow = NonNullable<typeof atsRes.data>[number];
    const atsMap: Record<string, AtsScoreRow> = {};
    for (const score of atsRes.data ?? []) {
      if (!atsMap[score.resume_version_id]) {
        atsMap[score.resume_version_id] = score;
      }
    }
    const clMap = Object.fromEntries(
      (clRes.data ?? []).map((c) => [c.resume_version_id, c])
    );

    for (const v of versions) {
      const jd = jdMap[v.job_description_id];
      if (!jd) continue;
      history.push({
        resume_version: {
          id: v.id,
          status: v.status,
          output_filename: v.output_filename,
          output_storage_path: v.output_storage_path,
          created_at: v.created_at,
        },
        job_description: {
          id: jd.id,
          title: jd.title,
          company: jd.company,
          source_type: jd.source_type,
        },
        interview: interviewMap[v.id] ?? null,
        latest_ats_score: atsMap[v.id] ?? null,
        cover_letter: clMap[v.id] ?? null,
      });
    }
  }

  const totalApplications = history.length;
  const readyResumes = history.filter(
    (e) => e.resume_version.status === "ready"
  ).length;
  const scoredEntries = history.filter((e) => e.latest_ats_score);
  const avgAts =
    scoredEntries.length > 0
      ? Math.round(
          scoredEntries.reduce(
            (sum, e) => sum + (e.latest_ats_score?.overall_score ?? 0),
            0
          ) / scoredEntries.length
        )
      : null;

  const statCards = [
    { label: "Applications", value: totalApplications, icon: Briefcase },
    { label: "Resumes Ready", value: readyResumes, icon: FileText },
    {
      label: "Avg ATS Score",
      value: avgAts !== null ? `${avgAts}/100` : "—",
      icon: CheckCircle,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Track your job applications and resume performance.
          </p>
        </div>
        <Button asChild>
          <Link href="/jds" className="gap-1.5">
            <Plus className="h-4 w-4" />
            New Application
          </Link>
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {statCards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="rounded-lg bg-primary/10 p-2.5">
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

      {/* History table */}
      {history.length > 0 ? (
        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-medium">Application history</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-xs text-muted-foreground border-b bg-neutral-50">
                <th className="text-left py-2 px-4 font-medium">Role</th>
                <th className="text-left py-2 px-4 font-medium">Date</th>
                <th className="text-left py-2 px-4 font-medium">Interview</th>
                <th className="text-left py-2 px-4 font-medium">Resume</th>
                <th className="text-left py-2 px-4 font-medium">ATS</th>
                <th className="text-right py-2 px-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <HistoryRow key={entry.resume_version.id} entry={entry} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <Briefcase className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">No applications yet</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Add a job description and start your first analysis.
          </p>
          <Button asChild size="sm">
            <Link href="/jds">
              <Plus className="h-4 w-4 mr-1.5" />
              Add your first job
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
