import Link from "next/link";
import { Building2, Calendar, ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeleteJdButton } from "@/components/jd/delete-jd-button";

interface JdCardProps {
  jd: {
    id: string;
    title: string | null;
    company: string | null;
    created_at: string;
    source_url: string | null;
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
