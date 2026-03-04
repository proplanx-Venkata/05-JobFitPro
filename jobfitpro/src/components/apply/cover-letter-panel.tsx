"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eye, FileDown, Loader2, Pencil, RefreshCw, X } from "lucide-react";
import type { CoverLetterContent } from "@/types/cover-letter";

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

  // PDF preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editContent, setEditContent] = useState<CoverLetterContent | null>(null);

  async function handleGenerate() {
    setLoading(true);
    try {
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
        return;
      }
      const newId = data.id ?? data.data?.id;
      setCoverId(newId);
      const urlRes = await fetch(`/api/cover-letters/${newId}/pdf-url`);
      if (urlRes.ok) {
        const { url } = await urlRes.json();
        setPdfUrl(url);
      }
      toast.success("Cover letter generated!");
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchUrl(id: string) {
    try {
      const res = await fetch(`/api/cover-letters/${id}/pdf-url`);
      if (res.ok) {
        const { url } = await res.json();
        setPdfUrl(url);
        window.open(url, "_blank");
      } else {
        toast.error("Could not retrieve download link");
      }
    } catch {
      toast.error("Network error. Please try again.");
    }
  }

  async function handlePreview() {
    if (!coverId) return;
    if (pdfUrl) {
      setPreviewOpen(true);
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/cover-letters/${coverId}/pdf-url`);
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

  async function handleEditClick() {
    if (!coverId) return;
    setEditLoading(true);
    try {
      const res = await fetch(`/api/cover-letters/${coverId}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to load cover letter");
        return;
      }
      const content = data.data?.generated_content as CoverLetterContent | null;
      if (!content) {
        toast.error("Cover letter content not available");
        return;
      }
      setEditContent(content);
      setEditMode(true);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setEditLoading(false);
    }
  }

  async function handleSave() {
    if (!coverId || !editContent) return;
    setEditLoading(true);
    try {
      const res = await fetch(`/api/cover-letters/${coverId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generated_content: editContent }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save cover letter");
        return;
      }
      setPdfUrl(null); // clear cached URL so preview reloads updated PDF
      setEditMode(false);
      toast.success("Cover letter saved and PDF updated!");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setEditLoading(false);
    }
  }

  function updateParagraph(index: number, value: string) {
    if (!editContent) return;
    const paragraphs = [...editContent.paragraphs] as [string, string, string];
    paragraphs[index] = value;
    setEditContent({ ...editContent, paragraphs });
  }

  if (coverId && editMode && editContent) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Edit cover letter</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditMode(false)}
            className="gap-1.5 text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Greeting</Label>
            <Input
              value={editContent.greeting}
              onChange={(e) => setEditContent({ ...editContent, greeting: e.target.value })}
              placeholder="Dear Hiring Manager,"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Opening paragraph</Label>
            <Textarea
              value={editContent.paragraphs[0]}
              onChange={(e) => updateParagraph(0, e.target.value)}
              className="resize-none min-h-[80px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Body paragraph</Label>
            <Textarea
              value={editContent.paragraphs[1]}
              onChange={(e) => updateParagraph(1, e.target.value)}
              className="resize-none min-h-[80px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Closing paragraph</Label>
            <Textarea
              value={editContent.paragraphs[2]}
              onChange={(e) => updateParagraph(2, e.target.value)}
              className="resize-none min-h-[80px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Closing</Label>
            <Input
              value={editContent.closing}
              onChange={(e) => setEditContent({ ...editContent, closing: e.target.value })}
              placeholder="Sincerely,"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground">Candidate name (read-only)</Label>
            <p className="text-sm px-3 py-2 border rounded-md bg-neutral-50 text-muted-foreground">
              {editContent.candidate_name}
            </p>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={editLoading}
          className="gap-2"
        >
          {editLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save & Regenerate PDF"
          )}
        </Button>
      </div>
    );
  }

  if (coverId) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-medium text-green-800">
              Cover letter ready!
            </p>
            <p className="text-xs text-green-700 mt-0.5">
              150–200 words, tailored to the job description.
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
            <Button
              size="sm"
              variant="outline"
              onClick={handleEditClick}
              disabled={editLoading}
              className="gap-1.5"
            >
              <Pencil className="h-4 w-4" />
              {editLoading ? "Loading…" : "Edit"}
            </Button>
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
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(`/api/cover-letters/${coverId}/docx`, "_blank")}
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

        {/* PDF Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-4xl w-full">
            <DialogHeader>
              <DialogTitle>Cover Letter Preview</DialogTitle>
            </DialogHeader>
            {pdfUrl && (
              <iframe
                src={pdfUrl}
                className="w-full h-[75vh] rounded border"
                title="Cover Letter PDF Preview"
              />
            )}
          </DialogContent>
        </Dialog>
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
