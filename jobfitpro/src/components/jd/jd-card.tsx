import Link from "next/link";
import { Building2, Calendar, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteJdButton } from "@/components/jd/delete-jd-button";
import type { JdApplicationStatus, JdIngestionStatus } from "@/types/database";
import { cn } from "@/lib/utils";

const APP_STATUS_STYLES: Record<JdApplicationStatus, string> = {
  saved: "bg-neutral-100 text-neutral-600 border-neutral-200",
  applied: "bg-blue-100 text-blue-700 border-blue-200",
  phone_screen: "bg-purple-100 text-purple-700 border-purple-200",
  interview: "bg-yellow-100 text-yellow-700 border-yellow-200",
  offer: "bg-green-100 text-green-700 border-green-200",
  rejected: "bg-red-100 text-red-600 border-red-200",
  withdrawn: "bg-neutral-100 text-neutral-500 border-neutral-200",
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

interface JdCardProps {
  jd: {
    id: string;
    title: string | null;
    company: string | null;
    created_at: string;
    source_url: string | null;
    status?: JdIngestionStatus;
    application_status?: JdApplicationStatus;
  };
}

export function JdCard({ jd }: JdCardProps) {
  const date = new Date(jd.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base line-clamp-2">
            {jd.title ?? "Untitled Role"}
          </CardTitle>
          <DeleteJdButton jdId={jd.id} variant="icon" />
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-1.5">
        {jd.company && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            {jd.company}
          </div>
        )}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          {date}
        </div>
        {/* Processing status indicator */}
        {jd.status === "processing" && (
          <div className="flex items-center gap-1.5 text-xs text-blue-600">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Processing…
          </div>
        )}
        {jd.status === "error" && (
          <div className="flex items-center gap-1.5 text-xs text-red-600">
            <AlertCircle className="h-3.5 w-3.5" />
            Processing error
          </div>
        )}
        {/* Application pipeline badge */}
        {jd.application_status && jd.application_status !== "saved" && (
          <Badge
            variant="outline"
            className={cn("text-xs", APP_STATUS_STYLES[jd.application_status])}
          >
            {APP_STATUS_LABELS[jd.application_status]}
          </Badge>
        )}
      </CardContent>
      <CardFooter className="pt-0">
        <Button asChild size="sm" className="w-full gap-1">
          <Link href={`/jds/${jd.id}`}>
            View & Analyze
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
