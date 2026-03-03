import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import type { Gap } from "@/types/gap";

interface GapListProps {
  gaps: Gap[];
}

export function GapList({ gaps }: GapListProps) {
  if (gaps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No significant gaps found — your resume is a strong match!
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {gaps.map((gap, i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-lg border p-3 bg-white"
        >
          <Badge
            variant={gap.category === "required" ? "destructive" : "secondary"}
            className="mt-0.5 shrink-0 text-xs"
          >
            {gap.category}
          </Badge>
          <div className="min-w-0">
            <p className="text-sm font-medium">{gap.keyword}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {gap.reason}
              {gap.section && (
                <span className="ml-1 italic">— from {gap.section}</span>
              )}
            </p>
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(gap.keyword + " tutorial")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline mt-1"
            >
              Learn <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
