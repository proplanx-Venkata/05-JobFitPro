import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ParsedResume } from "@/types/resume";

interface SharePageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ pin?: string }>;
}

// ---------------------------------------------------------------------------
// Public share page — no auth required.
// URL: /share/[token]?pin=XXXXXX
//
// Flow:
//   1. No ?pin query → show PIN entry form (nothing revealed)
//   2. ?pin present → lookup resume_version by token + pin via admin client
//      - Match → render resume content
//      - No match → show "Incorrect PIN" error + form
// ---------------------------------------------------------------------------
export default async function SharePage({ params, searchParams }: SharePageProps) {
  const { token } = await params;
  const { pin } = await searchParams;

  let resume: ParsedResume | null = null;
  let pinError = false;

  if (pin) {
    const adminClient = createSupabaseAdminClient();
    const { data: version } = await adminClient
      .from("resume_versions")
      .select("rewritten_content, resume_id")
      .eq("share_token", token)
      .eq("share_pin", pin)
      .eq("status", "ready")
      .limit(1)
      .single();

    if (version) {
      // Prefer rewritten_content; fall back to master parsed_content
      if (version.rewritten_content) {
        resume = version.rewritten_content as unknown as ParsedResume;
      } else if (version.resume_id) {
        const { data: master } = await adminClient
          .from("resumes")
          .select("parsed_content")
          .eq("id", version.resume_id)
          .single();
        if (master?.parsed_content) {
          resume = master.parsed_content as unknown as ParsedResume;
        }
      }
    } else {
      pinError = true;
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b px-6 py-4 flex items-center gap-2">
        <a href="/" className="font-bold text-lg text-blue-600">
          JobFit Pro
        </a>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {!resume ? (
          <PinGate error={pinError} token={token} />
        ) : (
          <ResumeView resume={resume} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t px-6 py-4 text-center text-xs text-gray-500">
        Optimized with{" "}
        <a href="/" className="text-blue-600 hover:underline">
          JobFit Pro
        </a>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PIN Entry Form (GET form — submits as ?pin=XXXXXX)
// ---------------------------------------------------------------------------
function PinGate({ error, token }: { error: boolean; token: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6">
      <div className="text-center space-y-2">
        <h1 className="text-xl font-bold">Enter the PIN to view this resume</h1>
        {error && (
          <p className="text-sm text-red-600">Incorrect PIN or invalid link. Please try again.</p>
        )}
      </div>
      <form
        method="GET"
        action={`/share/${token}`}
        className="flex flex-col items-center gap-3 w-full max-w-xs"
      >
        <input
          name="pin"
          type="text"
          inputMode="numeric"
          maxLength={6}
          required
          pattern="\d{6}"
          placeholder="6-digit PIN"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-center font-mono text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          View Resume
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resume Content Renderer
// ---------------------------------------------------------------------------
function ResumeView({ resume }: { resume: ParsedResume }) {
  const info = resume.personal_info;
  const allSkills = [
    ...(resume.skills?.technical ?? []),
    ...(resume.skills?.soft ?? []),
    ...(resume.skills?.other ?? []),
  ];

  return (
    <div className="space-y-8 font-sans text-gray-900">
      {/* Contact */}
      <div className="space-y-1">
        {info?.name && <h1 className="text-3xl font-bold">{info.name}</h1>}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
          {info?.email && <span>{info.email}</span>}
          {info?.phone && <span>{info.phone}</span>}
          {info?.location && <span>{info.location}</span>}
          {info?.linkedin && (
            <a href={info.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              LinkedIn
            </a>
          )}
          {info?.website && (
            <a href={info.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              Website
            </a>
          )}
        </div>
      </div>

      {/* Summary */}
      {resume.summary && (
        <section>
          <h2 className="text-lg font-semibold border-b pb-1 mb-2">Summary</h2>
          <p className="text-sm leading-relaxed">{resume.summary}</p>
        </section>
      )}

      {/* Experience */}
      {resume.experience?.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold border-b pb-1 mb-3">Experience</h2>
          <div className="space-y-4">
            {resume.experience.map((exp, i) => (
              <div key={i}>
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5">
                  <div>
                    <span className="font-medium">{exp.title}</span>
                    {exp.company && (
                      <span className="text-gray-600"> — {exp.company}</span>
                    )}
                  </div>
                  {(exp.start_date || exp.end_date) && (
                    <span className="text-xs text-gray-500 shrink-0">
                      {exp.start_date ?? ""}{exp.end_date ? ` – ${exp.end_date}` : ""}
                    </span>
                  )}
                </div>
                {exp.location && (
                  <p className="text-xs text-gray-500">{exp.location}</p>
                )}
                {exp.bullets?.length > 0 && (
                  <ul className="mt-1.5 space-y-1 list-disc list-inside text-sm text-gray-700">
                    {exp.bullets.map((b, j) => (
                      <li key={j}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Skills */}
      {allSkills.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold border-b pb-1 mb-2">Skills</h2>
          <div className="flex flex-wrap gap-2">
            {allSkills.map((skill, i) => (
              <span
                key={i}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-0.5 text-xs text-gray-700"
              >
                {skill}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Education */}
      {resume.education?.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold border-b pb-1 mb-3">Education</h2>
          <div className="space-y-2">
            {resume.education.map((edu, i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5">
                <div>
                  <span className="font-medium">{edu.institution}</span>
                  {(edu.degree || edu.field) && (
                    <span className="text-gray-600 text-sm">
                      {" "}— {[edu.degree, edu.field].filter(Boolean).join(", ")}
                    </span>
                  )}
                </div>
                {(edu.start_date || edu.end_date) && (
                  <span className="text-xs text-gray-500 shrink-0">
                    {edu.start_date ?? ""}{edu.end_date ? ` – ${edu.end_date}` : ""}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
