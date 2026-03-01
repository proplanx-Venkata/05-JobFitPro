"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

interface StartAnalysisButtonProps {
  resumeId: string;
  jdId: string;
}

export function StartAnalysisButton({ resumeId, jdId }: StartAnalysisButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    setLoading(true);

    const res = await fetch("/api/resume-versions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume_id: resumeId, job_description_id: jdId }),
    });

    const data = await res.json();

    if (!res.ok) {
      toast.error(data.error ?? "Failed to start analysis");
      setLoading(false);
      return;
    }

    toast.success("Gap analysis complete — starting interview");
    router.push(`/apply/${data.data.resume_version.id}`);
  }

  return (
    <Button onClick={handleStart} disabled={loading} size="lg" className="gap-2">
      <Zap className="h-4 w-4" />
      {loading ? "Analyzing…" : "Start Analysis"}
    </Button>
  );
}
