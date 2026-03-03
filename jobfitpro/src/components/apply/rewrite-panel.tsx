"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Eye, FileDown, Loader2, RefreshCw, Share2 } from "lucide-react";

interface RewritePanelProps {
  versionId: string;
  initialStatus: string;
  initialPdfPath: string | null;
  initialShareToken: string | null;
  initialSharePin: string | null;
}

export function RewritePanel({
  versionId,
  initialStatus,
  initialPdfPath,
  initialShareToken,
  initialSharePin,
}: RewritePanelProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // PDF preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Share
  const [shareToken, setShareToken] = useState<string | null>(initialShareToken);
  const [sharePin, setSharePin] = useState<string | null>(initialSharePin);
  const [pinInput, setPinInput] = useState("");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

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

  async function handlePreview() {
    if (pdfUrl) {
      setPreviewOpen(true);
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/resume-versions/${versionId}/pdf-url`);
      if (res.ok) {
        const { url } = await res.json();
        setPdfUrl(url);
        setPreviewOpen(true);
      } else {
        toast.error("Could not retrieve PDF for preview");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleCreateShare() {
    if (!pinInput || !/^\d{6}$/.test(pinInput)) {
      toast.error("PIN must be exactly 6 digits");
      return;
    }
    setShareLoading(true);
    try {
      const res = await fetch(`/api/resume-versions/${versionId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create share link");
        return;
      }
      const token = data.data.shareUrl.split("/share/")[1];
      setShareToken(token);
      setSharePin(pinInput);
      setPinInput("");
      toast.success("Share link created!");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setShareLoading(false);
    }
  }

  const shareUrl = shareToken
    ? `${window.location.origin}/share/${shareToken}`
    : null;

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
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={handlePreview}
              disabled={previewLoading}
              className="gap-1.5"
            >
              <Eye className="h-4 w-4" />
              {previewLoading ? "Loading…" : "Preview"}
            </Button>
            {pdfUrl ? (
              <Button asChild size="sm" variant="outline" className="gap-1.5" disabled={loading}>
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                  <FileDown className="h-4 w-4" />
                  Download PDF
                </a>
              </Button>
            ) : (
              <DownloadButton versionId={versionId} disabled={loading} onUrl={setPdfUrl} />
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
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShareDialogOpen(true)}
              className="gap-1.5"
            >
              <Share2 className="h-4 w-4" />
              {shareToken ? "Share Link" : "Share"}
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

        {/* PDF Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-4xl w-full">
            <DialogHeader>
              <DialogTitle>Resume Preview</DialogTitle>
            </DialogHeader>
            {pdfUrl && (
              <iframe
                src={pdfUrl}
                className="w-full h-[75vh] rounded border"
                title="Resume PDF Preview"
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Share Dialog */}
        <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Share this resume</DialogTitle>
            </DialogHeader>
            {shareToken && shareUrl ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Send both the URL and PIN to your recipient.
                </p>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">URL</p>
                    <div className="flex items-center gap-2">
                      <Input readOnly value={shareUrl} className="text-xs" />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(shareUrl);
                          toast.success("URL copied!");
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">PIN</p>
                    <div className="flex items-center gap-2">
                      <Input readOnly value={sharePin ?? ""} className="text-xs font-mono" />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(sharePin ?? "");
                          toast.success("PIN copied!");
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Choose a 6-digit PIN that recipients will need to view your resume.
                </p>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">PIN</p>
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="e.g. 123456"
                    className="font-mono"
                  />
                </div>
                <Button
                  onClick={handleCreateShare}
                  disabled={shareLoading || pinInput.length !== 6}
                  className="w-full gap-2"
                >
                  {shareLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    "Create Share Link"
                  )}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
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

function DownloadButton({
  versionId,
  disabled,
  onUrl,
}: {
  versionId: string;
  disabled?: boolean;
  onUrl?: (url: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function fetchUrl() {
    setLoading(true);
    try {
      const res = await fetch(`/api/resume-versions/${versionId}/pdf-url`);
      if (res.ok) {
        const { url: signed } = await res.json();
        onUrl?.(signed);
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
