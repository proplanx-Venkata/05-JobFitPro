import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Calendar, ExternalLink } from "lucide-react";
import { StartAnalysisButton } from "@/components/jd/start-analysis-button";
import { DeleteJdButton } from "@/components/jd/delete-jd-button";
import { JdTracker } from "@/components/jd/jd-tracker";

interface JdDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function JdDetailPage({ params }: JdDetailPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: jd } = await supabase
    .from("job_descriptions")
    .select("id, title, company, source_url, cleaned_text, created_at, application_status, notes, applied_at")
    .eq("id", id)
    .eq("user_id", user!.id)
    .single();

  if (!jd) notFound();

  // Check for active resume
  const { data: resume } = await supabase
    .from("resumes")
    .select("id")
    .eq("user_id", user!.id)
    .eq("is_active", true)
    .single();

  // Check if analysis already started for this JD
  const { data: existingVersion } = await supabase
    .from("resume_versions")
    .select("id")
    .eq("job_description_id", jd.id)
    .single();

  const date = new Date(jd.created_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-2xl font-bold">{jd.title ?? "Job Description"}</h2>
          <DeleteJdButton jdId={jd.id} redirectTo="/jds" variant="button" />
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          {jd.company && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              {jd.company}
            </div>
          )}
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {date}
          </div>
          {jd.source_url && (
            <a
              href={jd.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              Original posting
            </a>
          )}
        </div>
      </div>

      {/* Application Tracker */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Application Tracker</CardTitle>
        </CardHeader>
        <CardContent>
          <JdTracker
            jdId={jd.id}
            initialStatus={jd.application_status ?? "saved"}
            initialNotes={jd.notes ?? null}
            initialAppliedAt={jd.applied_at ?? null}
          />
        </CardContent>
      </Card>

      {/* CTA */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-medium">Ready to optimize your resume?</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {existingVersion
                ? "Analysis already started — continue your workflow."
                : !resume
                ? "Upload a resume first to start analysis."
                : "Run gap analysis + interview to generate a tailored resume."}
            </p>
          </div>
          {existingVersion ? (
            <a
              href={`/apply/${existingVersion.id}`}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Continue workflow →
            </a>
          ) : resume ? (
            <StartAnalysisButton resumeId={resume.id} jdId={jd.id} />
          ) : (
            <Badge variant="secondary">Upload a resume first</Badge>
          )}
        </CardContent>
      </Card>

      {/* Cleaned text */}
      {jd.cleaned_text && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Job description</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-sans leading-relaxed max-h-[60vh] overflow-y-auto">
              {jd.cleaned_text}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
