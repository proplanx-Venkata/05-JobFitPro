"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { JdApplicationStatus } from "@/types/database";

const STATUS_LABELS: Record<JdApplicationStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  phone_screen: "Phone Screen",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

interface JdTrackerProps {
  jdId: string;
  initialStatus: JdApplicationStatus;
  initialNotes: string | null;
  initialAppliedAt: string | null;
}

export function JdTracker({ jdId, initialStatus, initialNotes, initialAppliedAt }: JdTrackerProps) {
  const [appStatus, setAppStatus] = useState<JdApplicationStatus>(initialStatus);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [appliedAt, setAppliedAt] = useState(
    initialAppliedAt ? initialAppliedAt.split("T")[0] : ""
  );

  async function save(updates: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/jds/${jdId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to save");
      }
    } catch {
      toast.error("Network error. Please try again.");
    }
  }

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as JdApplicationStatus;
    setAppStatus(newStatus);
    save({ application_status: newStatus });
  }

  function handleAppliedAtChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setAppliedAt(val);
    save({ applied_at: val ? new Date(val).toISOString() : null });
  }

  function handleNotesBlur() {
    save({ notes: notes || null });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">
          Application Status
        </Label>
        <select
          value={appStatus}
          onChange={handleStatusChange}
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {(Object.keys(STATUS_LABELS) as JdApplicationStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">
          Applied On
        </Label>
        <Input
          type="date"
          className="h-9 text-sm"
          value={appliedAt}
          onChange={handleAppliedAtChange}
        />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">
          Notes
        </Label>
        <Textarea
          className="text-sm resize-none"
          rows={2}
          placeholder="Interview notes, follow-up reminders…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
        />
      </div>
    </div>
  );
}
