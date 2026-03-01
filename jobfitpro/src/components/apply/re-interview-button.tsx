"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw } from "lucide-react";

interface ReInterviewButtonProps {
  sessionId: string;
}

export function ReInterviewButton({ sessionId }: ReInterviewButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    setLoading(true);

    const res = await fetch(`/api/interview-sessions/${sessionId}/reset`, {
      method: "POST",
    });
    const data = await res.json();

    if (!res.ok) {
      toast.error(data.error ?? "Failed to reset interview");
      setLoading(false);
      return;
    }

    toast.success("Interview reset — you can start again.");
    router.refresh();
    setLoading(false);
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleReset}
      disabled={loading}
      className="gap-1.5 text-muted-foreground"
    >
      {loading ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Resetting…
        </>
      ) : (
        <>
          <RotateCcw className="h-3.5 w-3.5" />
          Re-interview
        </>
      )}
    </Button>
  );
}
