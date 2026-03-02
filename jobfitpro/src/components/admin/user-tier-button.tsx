"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Props {
  userId: string;
  currentTier: "free" | "paid";
  monthlyCount: number;
}

export function UserTierButton({ userId, currentTier, monthlyCount }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"tier" | "quota" | null>(null);

  async function patchUser(body: object) {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error ?? "Request failed");
    }
  }

  async function handleTierToggle() {
    const newTier = currentTier === "free" ? "paid" : "free";
    setLoading("tier");
    try {
      await patchUser({ action: "set_tier", tier: newTier });
      toast.success(`User upgraded to ${newTier}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update tier");
    } finally {
      setLoading(null);
    }
  }

  async function handleResetQuota() {
    setLoading("quota");
    try {
      await patchUser({ action: "reset_quota" });
      toast.success("Monthly quota reset");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset quota");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-2 justify-end">
      <Button
        size="sm"
        variant={currentTier === "free" ? "default" : "outline"}
        disabled={loading !== null}
        onClick={handleTierToggle}
        className="h-7 text-xs"
      >
        {loading === "tier"
          ? "Saving…"
          : currentTier === "free"
          ? "Upgrade to Paid"
          : "Downgrade to Free"}
      </Button>
      {monthlyCount > 0 && (
        <Button
          size="sm"
          variant="outline"
          disabled={loading !== null}
          onClick={handleResetQuota}
          className="h-7 text-xs text-destructive hover:text-destructive"
        >
          {loading === "quota" ? "Resetting…" : "Reset Quota"}
        </Button>
      )}
    </div>
  );
}
