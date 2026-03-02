"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2, RefreshCw } from "lucide-react";

interface RewritePanelProps {
  versionId: string;
  initialStatus: string;
  initialPdfPath: string | null;
}

export function RewritePanel({
  versionId,
  initialStatus,
  initialPdfPath,
}: RewritePanelProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRewrite() {
    setLoading(true);
    setStatus("generating");
    try {
      const res = await fetch(`/api/resume-versions/${versionId}/rewrite`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Rewrite failed");
        setStatus("error");
        return;
      }
      // Best-effort signed URL fetch — download button still works if this fails
      const signedRes = await fetch(`/api/resume-versions/${versionId}/pdf-url`);
      if (signedRes.ok) {
        const { url } = await signedRes.json();
        setPdfUrl(url);
      }
      setStatus("ready");
      toast.success("Resume rewritten successfully!");
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }

  if (status === "ready" || initialPdfPath) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-medium text-green-800">
              Resume ready!
            </p>
            <p className="text-xs text-green-700 mt-0.5">
              Your tailored resume has been generated.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {pdfUrl ? (
              <Button asChild size="sm" variant="outline" className="gap-1.5" disabled={loading}>
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                  <FileDown className="h-4 w-4" />
                  Download PDF
                </a>
              </Button>
            ) : (
              <DownloadButton versionId={versionId} disabled={loading} />
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(`/api/resume-versions/${versionId}/docx`, "_blank")}
              disabled={loading}
              className="gap-1.5"
            >
              <FileDown className="h-4 w-4" />
              Download DOCX
            </Button>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRewrite}
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
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Generate a tailored resume using your interview answers and the job
        description keywords. The master resume content is preserved — only
        bullets and summary are enhanced.
      </p>
      {status === "error" && (
        <p className="text-sm text-destructive">
          Previous generation failed. Try again.
        </p>
      )}
      <Button onClick={handleRewrite} disabled={loading} className="gap-2">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating resume…
          </>
        ) : (
          "Generate Resume"
        )}
      </Button>
    </div>
  );
}

function DownloadButton({ versionId, disabled }: { versionId: string; disabled?: boolean }) {
  const [loading, setLoading] = useState(false);

  async function fetchUrl() {
    setLoading(true);
    try {
      const res = await fetch(`/api/resume-versions/${versionId}/pdf-url`);
      if (res.ok) {
        const { url: signed } = await res.json();
        window.open(signed, "_blank");
      } else {
        toast.error("Could not retrieve download link");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={fetchUrl} disabled={disabled || loading} className="gap-1.5">
      <FileDown className="h-4 w-4" />
      {loading ? "Loading…" : "Download PDF"}
    </Button>
  );
}
