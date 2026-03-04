import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JdForm } from "@/components/jd/jd-form";
import { JdCard } from "@/components/jd/jd-card";
import { Briefcase } from "lucide-react";

export default async function JdsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: jds } = await supabase
    .from("job_descriptions")
    .select("id, title, company, source_url, created_at, status, application_status")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Job Listings</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Add job descriptions to generate tailored resumes.
        </p>
      </div>

      {/* Add new JD */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a job description</CardTitle>
        </CardHeader>
        <CardContent>
          <JdForm />
        </CardContent>
      </Card>

      {/* JD grid */}
      {jds && jds.length > 0 ? (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            {jds.length} job{jds.length !== 1 ? "s" : ""} saved
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {jds.map((jd) => (
              <JdCard key={jd.id} jd={jd} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <Briefcase className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">No job descriptions yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add a job description above to get started.
          </p>
        </div>
      )}
    </div>
  );
}
