"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import type { PrepQuestion } from "@/lib/interview-prep/generate-with-claude";

interface InterviewPrepPanelProps {
  versionId: string;
}

const CATEGORY_LABELS: Record<PrepQuestion["category"], string> = {
  behavioral: "Behavioral",
  technical: "Technical",
  situational: "Situational",
};

const CATEGORY_ORDER: PrepQuestion["category"][] = ["behavioral", "technical", "situational"];

export function InterviewPrepPanel({ versionId }: InterviewPrepPanelProps) {
  const [questions, setQuestions] = useState<PrepQuestion[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch("/api/interview-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume_version_id: versionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to generate questions");
        return;
      }
      setQuestions(data.data?.questions ?? []);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Generating…
      </div>
    );
  }

  if (!questions) {
    return (
      <Button onClick={generate} className="gap-2">
        Generate Interview Questions
      </Button>
    );
  }

  return (
    <div className="space-y-5">
      {CATEGORY_ORDER.map((cat) => {
        const items = questions.filter((q) => q.category === cat);
        if (items.length === 0) return null;
        return (
          <div key={cat}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {CATEGORY_LABELS[cat]}
            </p>
            <div className="space-y-3">
              {items.map((q, i) => (
                <div key={i} className="rounded-lg border p-3 bg-white">
                  <p className="text-sm font-medium">{q.question}</p>
                  <p className="text-xs text-muted-foreground italic mt-1">{q.tip}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <Button
        variant="ghost"
        size="sm"
        onClick={generate}
        disabled={loading}
        className="gap-1.5 text-muted-foreground"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Regenerate
      </Button>
    </div>
  );
}
