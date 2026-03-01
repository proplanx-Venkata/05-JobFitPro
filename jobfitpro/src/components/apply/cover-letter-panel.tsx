"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDown, Loader2, RefreshCw } from "lucide-react";

interface CoverLetterPanelProps {
  versionId: string;
  existingCoverId: string | null;
}

export function CoverLetterPanel({
  versionId,
  existingCoverId,
}: CoverLetterPanelProps) {
  const router = useRouter();
  const [coverId, setCoverId] = useState<string | null>(existingCoverId);
  const [loading, setLoading] = useState(false);
  const [recruiterName, setRecruiterName] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);

    const res = await fetch("/api/cover-letters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume_version_id: versionId,
        recruiter_name: recruiterName || undefined,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      toast.error(data.error ?? "Failed to generate cover letter");
      setLoading(false);
      return;
    }

    const newId = data.id ?? data.data?.id;
    setCoverId(newId);

    // Get signed URL
    const urlRes = await fetch(`/api/cover-letters/${newId}/pdf-url`);
    if (urlRes.ok) {
      const { url } = await urlRes.json();
      setPdfUrl(url);
    }

    toast.success("Cover letter generated!");
    router.refresh();
    setLoading(false);
  }

  async function fetchUrl(id: string) {
    const res = await fetch(`/api/cover-letters/${id}/pdf-url`);
    if (res.ok) {
      const { url } = await res.json();
      setPdfUrl(url);
      window.open(url, "_blank");
    } else {
      toast.error("Could not retrieve download link");
    }
  }

  if (coverId) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-green-800">
              Cover letter ready!
            </p>
            <p className="text-xs text-green-700 mt-0.5">
              150–200 words, tailored to the job description.
            </p>
          </div>
          {pdfUrl ? (
            <Button asChild size="sm" variant="outline" className="gap-1.5" disabled={loading}>
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                <FileDown className="h-4 w-4" />
                Download PDF
              </a>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchUrl(coverId)}
              disabled={loading}
              className="gap-1.5"
            >
              <FileDown className="h-4 w-4" />
              Download PDF
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleGenerate}
          disabled={loading}
          className="gap-1.5 text-muted-foreground"
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Regenerating…
            </>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Generate a targeted cover letter (150–200 words) based on your rewritten
        resume and interview answers.
      </p>
      <div className="space-y-1.5 max-w-xs">
        <Label htmlFor="recruiter-name">Recruiter name (optional)</Label>
        <Input
          id="recruiter-name"
          value={recruiterName}
          onChange={(e) => setRecruiterName(e.target.value)}
          placeholder="Jane Smith"
        />
      </div>
      <Button onClick={handleGenerate} disabled={loading} className="gap-2">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating…
          </>
        ) : (
          "Generate Cover Letter"
        )}
      </Button>
    </div>
  );
}
