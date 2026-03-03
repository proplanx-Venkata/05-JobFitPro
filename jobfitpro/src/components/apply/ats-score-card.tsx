"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface AtsScore {
  id: string;
  overall_score: number;
  category: string;
  keyword_match_score: number | null;
  format_score: number | null;
  skills_score: number | null;
  experience_score: number | null;
  missing_keywords: string[];
  gap_explanations: Record<string, string>;
  passes_threshold: boolean;
}

interface AtsScoreCardProps {
  versionId: string;
  initialScore: AtsScore | null;
  preRewriteScore: { overall_score: number; category: string } | null;
}

function categoryColor(cat: string) {
  if (cat === "Excellent") return "bg-green-100 text-green-800";
  if (cat === "Strong") return "bg-blue-100 text-blue-800";
  return "bg-red-100 text-red-800";
}

function scoreRingColor(score: number) {
  if (score >= 85) return "text-green-600";
  if (score >= 70) return "text-blue-600";
  return "text-red-500";
}

const componentLabels: Record<string, string> = {
  keyword_match_score: "Keyword Match",
  skills_score: "Skills",
  experience_score: "Experience",
  format_score: "Format",
};

export function AtsScoreCard({ versionId, initialScore, preRewriteScore }: AtsScoreCardProps) {
  const [score, setScore] = useState<AtsScore | null>(initialScore);
  const [loading, setLoading] = useState(false);

  async function handleScore() {
    setLoading(true);
    try {
      const res = await fetch("/api/ats-scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume_version_id: versionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Scoring failed");
        return;
      }
      setScore(data.data ?? data);
      toast.success("ATS score calculated!");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!score) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Score your resume against the job description to see how well it
          performs with applicant tracking systems.
        </p>
        <Button onClick={handleScore} disabled={loading} className="gap-2">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Scoring…
            </>
          ) : (
            "Get ATS Score"
          )}
        </Button>
      </div>
    );
  }

  const components = [
    { key: "keyword_match_score", value: score.keyword_match_score },
    { key: "skills_score", value: score.skills_score },
    { key: "experience_score", value: score.experience_score },
    { key: "format_score", value: score.format_score },
  ];

  const delta = preRewriteScore
    ? score.overall_score - preRewriteScore.overall_score
    : null;

  return (
    <div className="space-y-5">
      {/* Before / After banner */}
      {preRewriteScore && delta !== null && (
        <div className="flex items-center gap-4 rounded-lg border bg-neutral-50 px-4 py-3 mb-2">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Before</p>
            <p className={cn("text-2xl font-bold", scoreRingColor(preRewriteScore.overall_score))}>
              {preRewriteScore.overall_score}
            </p>
          </div>
          <span className="text-muted-foreground">→</span>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">After</p>
            <p className={cn("text-2xl font-bold", scoreRingColor(score.overall_score))}>
              {score.overall_score}
            </p>
          </div>
          <span className={cn("ml-auto font-semibold", delta >= 0 ? "text-green-600" : "text-red-500")}>
            {delta >= 0 ? "+" : ""}{delta} pts
          </span>
        </div>
      )}

      {/* Overall score */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="text-center">
          <p
            className={cn(
              "text-5xl font-bold",
              scoreRingColor(score.overall_score)
            )}
          >
            {score.overall_score}
          </p>
          <p className="text-xs text-muted-foreground mt-1">out of 100</p>
        </div>
        <div className="space-y-1.5">
          <Badge className={categoryColor(score.category)}>
            {score.category}
          </Badge>
          <p className="text-xs text-muted-foreground">
            {score.passes_threshold
              ? "Above threshold — good match!"
              : "Below threshold — more optimization needed."}
          </p>
        </div>
      </div>

      {/* Component breakdown */}
      <div className="space-y-3">
        {components.map(({ key, value }) => (
          <div key={key} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                {componentLabels[key]}
              </span>
              <span className="font-medium">{value ?? "—"}</span>
            </div>
            <Progress value={value ?? 0} className="h-1.5" />
          </div>
        ))}
      </div>

      {/* Missing keywords */}
      {score.missing_keywords?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Missing keywords
          </p>
          <div className="flex flex-wrap gap-1.5">
            {score.missing_keywords.map((kw) => (
              <a
                key={kw}
                href={`https://www.google.com/search?q=${encodeURIComponent(kw + " tutorial")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                title={score.gap_explanations?.[kw]}
              >
                {kw}
                <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
              </a>
            ))}
          </div>
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={handleScore}
        disabled={loading}
        className="gap-1.5 text-muted-foreground"
      >
        {loading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Re-scoring…
          </>
        ) : (
          <>
            <RefreshCw className="h-3.5 w-3.5" />
            Re-score
          </>
        )}
      </Button>
    </div>
  );
}
