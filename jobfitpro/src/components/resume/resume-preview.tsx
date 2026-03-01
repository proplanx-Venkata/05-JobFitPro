import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { ParsedResume } from "@/types/resume";

interface ResumePreviewProps {
  resume: {
    id: string;
    original_filename: string;
    status: string;
    created_at: string;
    parsed_content: ParsedResume;
  };
}

export function ResumePreview({ resume }: ResumePreviewProps) {
  const { parsed_content: r } = resume;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            {r.personal_info.name ?? "Your Resume"}
          </h2>
          <div className="flex flex-wrap gap-2 mt-1 text-sm text-muted-foreground">
            {r.personal_info.email && <span>{r.personal_info.email}</span>}
            {r.personal_info.phone && <span>· {r.personal_info.phone}</span>}
            {r.personal_info.location && (
              <span>· {r.personal_info.location}</span>
            )}
          </div>
        </div>
        <Badge variant="secondary">{resume.original_filename}</Badge>
      </div>

      <Separator />

      {/* Summary */}
      {r.summary && (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Summary
          </h3>
          <p className="text-sm leading-relaxed">{r.summary}</p>
        </section>
      )}

      {/* Skills */}
      {(r.skills.technical.length > 0 || r.skills.soft.length > 0) && (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Skills
          </h3>
          <div className="space-y-2">
            {r.skills.technical.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground mr-2">Technical:</span>
                <div className="inline-flex flex-wrap gap-1">
                  {r.skills.technical.map((s) => (
                    <Badge key={s} variant="outline" className="text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {r.skills.soft.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground mr-2">Soft:</span>
                <div className="inline-flex flex-wrap gap-1">
                  {r.skills.soft.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Experience */}
      {r.experience.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Experience
          </h3>
          <div className="space-y-4">
            {r.experience.map((exp, i) => (
              <div key={i}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{exp.title}</p>
                    <p className="text-sm text-muted-foreground">{exp.company}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {exp.start_date} – {exp.end_date ?? "Present"}
                  </span>
                </div>
                {exp.bullets.length > 0 && (
                  <ul className="mt-2 space-y-1 list-disc list-inside">
                    {exp.bullets.map((b, j) => (
                      <li key={j} className="text-sm text-muted-foreground">
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Education */}
      {r.education.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Education
          </h3>
          <div className="space-y-3">
            {r.education.map((edu, i) => (
              <div key={i} className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-sm">{edu.institution}</p>
                  <p className="text-sm text-muted-foreground">
                    {[edu.degree, edu.field].filter(Boolean).join(", ")}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {edu.start_date} – {edu.end_date ?? "Present"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
