import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResumeUpload } from "@/components/resume/resume-upload";
import { ResumePreview } from "@/components/resume/resume-preview";
import { UploadCloud } from "lucide-react";
import type { ParsedResume } from "@/types/resume";

export default async function ResumePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: resume } = await supabase
    .from("resumes")
    .select("id, original_filename, status, created_at, parsed_content")
    .eq("user_id", user!.id)
    .eq("is_active", true)
    .single();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">My Resume</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Upload your master resume once — it&apos;s the foundation for all
          job-specific versions.
        </p>
      </div>

      {resume ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Parsed content</CardTitle>
            </CardHeader>
            <CardContent>
              <ResumePreview
                resume={{
                  ...resume,
                  parsed_content: resume.parsed_content as unknown as ParsedResume,
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Replace resume</CardTitle>
            </CardHeader>
            <CardContent>
              <ResumeUpload />
            </CardContent>
          </Card>
        </>
      ) : (
        <>
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
      )}
    </div>
  );
}
