import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: cl } = await supabase
    .from("cover_letters")
    .select("output_storage_path, resume_version_id")
    .eq("id", id)
    .single();

  if (!cl?.output_storage_path) {
    return NextResponse.json({ error: "PDF not available" }, { status: 404 });
  }

  // Verify ownership via resume_version
  const { data: version } = await supabase
    .from("resume_versions")
    .select("id")
    .eq("id", cl.resume_version_id)
    .eq("user_id", user.id)
    .single();

  if (!version) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: signed, error } = await admin.storage
    .from("outputs")
    .createSignedUrl(cl.output_storage_path, 3600);

  if (error || !signed) {
    return NextResponse.json({ error: "Could not generate URL" }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}
