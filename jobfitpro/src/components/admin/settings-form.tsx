"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Props {
  signupEnabled: boolean;
  freeLimit: number;
  paidLimit: number;
}

export function SettingsForm({ signupEnabled, freeLimit, paidLimit }: Props) {
  const router = useRouter();
  const [signupLoading, setSignupLoading] = useState(false);
  const [freeValue, setFreeValue] = useState(String(freeLimit));
  const [paidValue, setPaidValue] = useState(String(paidLimit));
  const [quotaLoading, setQuotaLoading] = useState<"free" | "paid" | null>(null);

  async function patchSetting(key: string, value: unknown) {
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error ?? "Failed to save setting");
    }
  }

  async function handleSignupToggle(open: boolean) {
    setSignupLoading(true);
    try {
      await patchSetting("signup_enabled", open);
      toast.success(open ? "Signups are now open" : "Signups are now closed");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSignupLoading(false);
    }
  }

  async function handleFreeLimit() {
    const n = parseInt(freeValue, 10);
    if (isNaN(n) || n < 0) {
      toast.error("Enter a valid non-negative number");
      return;
    }
    setQuotaLoading("free");
    try {
      await patchSetting("quota_free_limit", n);
      toast.success(`Free limit updated to ${n}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setQuotaLoading(null);
    }
  }

  async function handlePaidLimit() {
    const n = parseInt(paidValue, 10);
    if (isNaN(n) || n < 0) {
      toast.error("Enter a valid non-negative number");
      return;
    }
    setQuotaLoading("paid");
    try {
      await patchSetting("quota_paid_monthly_limit", n);
      toast.success(`Paid monthly limit updated to ${n}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setQuotaLoading(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Signup toggle */}
      <div>
        <h3 className="text-sm font-semibold mb-1">Signup Access</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Controls whether new users can register. Current status:{" "}
          <span
            className={`font-medium ${
              signupEnabled ? "text-green-600" : "text-red-600"
            }`}
          >
            {signupEnabled ? "Open" : "Closed"}
          </span>
        </p>
        <div className="flex gap-3">
          <Button
            variant={signupEnabled ? "outline" : "default"}
            disabled={signupLoading || signupEnabled}
            onClick={() => handleSignupToggle(true)}
            className="h-8 text-sm"
          >
            {signupLoading ? "Saving…" : "Open Signups"}
          </Button>
          <Button
            variant={signupEnabled ? "destructive" : "outline"}
            disabled={signupLoading || !signupEnabled}
            onClick={() => handleSignupToggle(false)}
            className="h-8 text-sm"
          >
            {signupLoading ? "Saving…" : "Close Signups"}
          </Button>
        </div>
      </div>

      {/* Quota limits */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className="text-sm font-semibold block mb-1">
            Free tier limit (total versions)
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Max resume versions a free user can create in total.
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              value={freeValue}
              onChange={(e) => setFreeValue(e.target.value)}
              className="h-8 w-24 rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <Button
              size="sm"
              disabled={quotaLoading !== null}
              onClick={handleFreeLimit}
              className="h-8"
            >
              {quotaLoading === "free" ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold block mb-1">
            Paid tier limit (versions / month)
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Max resume versions a paid user can create per calendar month.
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              value={paidValue}
              onChange={(e) => setPaidValue(e.target.value)}
              className="h-8 w-24 rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <Button
              size="sm"
              disabled={quotaLoading !== null}
              onClick={handlePaidLimit}
              className="h-8"
            >
              {quotaLoading === "paid" ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
