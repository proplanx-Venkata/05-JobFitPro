"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface DeleteJdButtonProps {
  jdId: string;
  /** Pass "/jds" to redirect after delete; omit to stay and refresh the list. */
  redirectTo?: string;
  variant?: "icon" | "button";
}

export function DeleteJdButton({ jdId, redirectTo, variant = "icon" }: DeleteJdButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const res = await fetch(`/api/jds/${jdId}`, { method: "DELETE" });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Failed to delete job description");
      setLoading(false);
      return;
    }

    toast.success("Job description deleted");
    setOpen(false);

    if (redirectTo) {
      router.push(redirectTo);
    } else {
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "icon" ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            title="Delete job description"
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete job description</span>
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:bg-destructive/10 border-destructive/30">
            <Trash2 className="h-4 w-4" />
            Delete JD
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete job description?</DialogTitle>
          <DialogDescription>
            This permanently removes the JD and all associated resumes, cover letters, interview
            transcripts, and ATS scores. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading} className="gap-2">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting…
              </>
            ) : (
              "Delete"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
