import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResumeUpload } from "@/components/resume/resume-upload";
import { ResumeCard } from "@/components/resume/resume-card";
import { UploadCloud, AlertTriangle } from "lucide-react";

export default async function ResumePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: resumes } = await supabase
    .from("resumes")
    .select(
      "id, original_filename, label, status, page_count, file_size_bytes, is_active, is_promoted, created_at"
    )
    .eq("user_id", user!.id)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  const count = resumes?.length ?? 0;
  const canUpload = count < 3;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">My Resumes</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Store up to 3 resumes. The active resume is used for all new job analyses.
        </p>
      </div>

      {count === 0 ? (
        <>
          {/* Empty state */}
          <div className="rounded-xl border border-dashed border-border bg-neutral-50 p-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-primary/10 p-4">
                <UploadCloud className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold">Upload your master resume</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Uploaded once — we&apos;ll tailor it to each job description.
              </p>
            </div>
            <ol className="text-sm text-muted-foreground space-y-1 text-left max-w-xs mx-auto">
              <li className="flex items-start gap-2">
                <span className="font-semibold text-primary shrink-0">①</span>
                <span>Upload resume</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-primary shrink-0">②</span>
                <span>Add a job description</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-primary shrink-0">③</span>
                <span>Get a tailored resume + ATS score</span>
              </li>
            </ol>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upload your resume</CardTitle>
            </CardHeader>
            <CardContent>
              <ResumeUpload />
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {/* Resume cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            {(resumes ?? []).map((resume) => (
              <ResumeCard key={resume.id} resume={resume} />
            ))}
          </div>

          {/* Upload section */}
          {canUpload ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Upload another resume</CardTitle>
              </CardHeader>
              <CardContent>
                <ResumeUpload />
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Resume limit reached</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  You have 3 resumes stored. Archive one to upload another.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
