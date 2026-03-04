import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { HistoryEntry } from "@/types/history";
import type { JdApplicationStatus } from "@/types/database";

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: "bg-neutral-100 text-neutral-600",
    in_progress: "bg-yellow-100 text-yellow-700",
    completed: "bg-green-100 text-green-700",
    generating: "bg-blue-100 text-blue-700",
    ready: "bg-green-100 text-green-700",
    error: "bg-red-100 text-red-700",
    aborted: "bg-red-100 text-red-700",
  };
  return map[status] ?? "bg-neutral-100 text-neutral-600";
}

function atsCategory(category: string) {
  if (category === "Excellent") return "text-green-700";
  if (category === "Strong") return "text-blue-700";
  return "text-red-600";
}

const APP_STATUS_STYLES: Record<JdApplicationStatus, string> = {
  saved: "bg-neutral-100 text-neutral-500",
  applied: "bg-blue-100 text-blue-700",
  phone_screen: "bg-purple-100 text-purple-700",
  interview: "bg-yellow-100 text-yellow-700",
  offer: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
  withdrawn: "bg-neutral-100 text-neutral-400",
};

const APP_STATUS_LABELS: Record<JdApplicationStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  phone_screen: "Phone Screen",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

interface HistoryRowProps {
  entry: HistoryEntry;
}

export function HistoryRow({ entry }: HistoryRowProps) {
  const { resume_version: rv, job_description: jd, interview, latest_ats_score: ats } = entry;

  const date = new Date(rv.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <tr className="border-b last:border-0 hover:bg-accent/30 transition-colors">
      {/* Role + Company */}
      <td className="py-3 px-4">
        <p className="font-medium text-sm">{jd.title ?? "Untitled Role"}</p>
        {jd.company && (
          <p className="text-xs text-muted-foreground">{jd.company}</p>
        )}
      </td>

      {/* Date */}
      <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
        {date}
      </td>

      {/* Application status */}
      <td className="py-3 px-4">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            APP_STATUS_STYLES[jd.application_status]
          )}
        >
          {APP_STATUS_LABELS[jd.application_status]}
        </span>
      </td>

      {/* Interview status */}
      <td className="py-3 px-4">
        {interview ? (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              statusBadge(interview.status)
            )}
          >
            {interview.status.replace("_", " ")}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>

      {/* Resume status */}
      <td className="py-3 px-4">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            statusBadge(rv.status)
          )}
        >
          {rv.status}
        </span>
      </td>

      {/* ATS score */}
      <td className="py-3 px-4">
        {ats ? (
          <span className={cn("text-sm font-semibold", atsCategory(ats.category))}>
            {ats.overall_score}
            <span className="text-xs font-normal text-muted-foreground ml-1">
              {ats.category}
            </span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>

      {/* Action */}
      <td className="py-3 px-4 text-right">
        <Button asChild size="sm" variant="ghost" className="gap-1">
          <Link href={`/apply/${rv.id}`}>
            View
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </td>
    </tr>
  );
}
