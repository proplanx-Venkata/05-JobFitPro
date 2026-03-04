"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FileText, Calendar, Archive, Star, Pencil, Check, X, Loader2 } from "lucide-react";

interface ResumeCardProps {
  resume: {
    id: string;
    original_filename: string;
    label: string | null;
    status: string;
    page_count: number | null;
    file_size_bytes: number;
    is_active: boolean;
    is_promoted: boolean;
    created_at: string;
  };
}

export function ResumeCard({ resume }: ResumeCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<"activate" | "archive" | "label" | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [labelInput, setLabelInput] = useState(resume.label ?? "");

  const displayName = resume.label || resume.original_filename;
  const date = new Date(resume.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const sizeKb = Math.round(resume.file_size_bytes / 1024);

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/resumes/${resume.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Request failed");
    return data;
  }

  async function handleSetActive() {
    setLoading("activate");
    try {
      await patch({ action: "set_active" });
      toast.success("Active resume updated.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to set active");
    } finally {
      setLoading(null);
    }
  }

  async function handleArchive() {
    setLoading("archive");
    try {
      await patch({ action: "archive" });
      toast.success("Resume archived.");
      setArchiveDialogOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to archive");
    } finally {
      setLoading(null);
    }
  }

  async function handleSaveLabel() {
    setLoading("label");
    try {
      await patch({ action: "set_label", label: labelInput });
      toast.success("Label updated.");
      setRenaming(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update label");
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      <Card className={resume.is_active ? "border-primary/60 ring-1 ring-primary/30" : ""}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {renaming ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value.slice(0, 80))}
                    className="h-7 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveLabel();
                      if (e.key === "Escape") { setRenaming(false); setLabelInput(resume.label ?? ""); }
                    }}
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={handleSaveLabel} disabled={loading === "label"}>
                    {loading === "label" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-green-600" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => { setRenaming(false); setLabelInput(resume.label ?? ""); }}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <CardTitle className="text-base truncate">{displayName}</CardTitle>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              {resume.is_active && (
                <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Active</Badge>
              )}
              {resume.is_promoted && (
                <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">Promoted</Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-1.5 pb-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            {resume.page_count ? `${resume.page_count} page${resume.page_count !== 1 ? "s" : ""}` : "—"} · {sizeKb} KB
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {date}
          </div>
          {resume.status !== "ready" && (
            <div className="text-xs text-amber-600 font-medium capitalize">{resume.status}</div>
          )}
        </CardContent>

        <CardFooter className="pt-0 flex gap-2 flex-wrap">
          {!resume.is_active && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={handleSetActive}
              disabled={loading !== null}
            >
              {loading === "activate" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Star className="h-3.5 w-3.5" />
              )}
              Set Active
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-muted-foreground"
            onClick={() => setRenaming(true)}
            disabled={loading !== null || renaming}
          >
            <Pencil className="h-3.5 w-3.5" />
            Rename
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-muted-foreground hover:text-destructive"
            onClick={() => setArchiveDialogOpen(true)}
            disabled={loading !== null}
          >
            <Archive className="h-3.5 w-3.5" />
            Archive
          </Button>
        </CardFooter>
      </Card>

      {/* Archive confirmation */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Archive resume?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This resume will be hidden from your list. The file is not deleted. You can
            upload a new resume in its place.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveDialogOpen(false)} disabled={loading === "archive"}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleArchive} disabled={loading === "archive"}>
              {loading === "archive" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Archiving…
                </>
              ) : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
