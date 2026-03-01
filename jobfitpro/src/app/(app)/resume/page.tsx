import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResumeUpload } from "@/components/resume/resume-upload";
import { ResumePreview } from "@/components/resume/resume-preview";
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload your resume</CardTitle>
          </CardHeader>
          <CardContent>
            <ResumeUpload />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
