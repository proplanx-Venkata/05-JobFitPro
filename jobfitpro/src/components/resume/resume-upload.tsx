"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ResumeUpload() {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }
  function onDragLeave() {
    setDragging(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  }
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setLoading(true);

    const formData = new FormData();
    formData.append("file", selectedFile);

    const res = await fetch("/api/resumes", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      toast.error(data.error ?? "Upload failed");
      setLoading(false);
      return;
    }

    toast.success("Resume uploaded and parsed successfully!");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors cursor-pointer",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-accent/30"
        )}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={onFileChange}
        />
        <Upload className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">
          {selectedFile ? selectedFile.name : "Drop your resume here"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF or DOCX · max 5 MB · up to 3 pages
        </p>
      </div>

      {selectedFile && (
        <div className="flex items-center gap-3 rounded-lg border bg-accent/30 p-3">
          <FileText className="h-5 w-5 text-primary shrink-0" />
          <span className="text-sm truncate flex-1">{selectedFile.name}</span>
          <Button size="sm" onClick={handleUpload} disabled={loading}>
            {loading ? "Uploading…" : "Upload"}
          </Button>
        </div>
      )}
    </div>
  );
}
