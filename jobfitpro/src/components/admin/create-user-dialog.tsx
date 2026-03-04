"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Check, Copy, Eye, EyeOff, Plus } from "lucide-react";

interface Credentials {
  email: string;
  password: string;
}

export function CreateUserDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tier, setTier] = useState<"free" | "paid">("free");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Success state
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  function resetForm() {
    setFullName("");
    setEmail("");
    setPassword("");
    setTier("free");
    setShowPassword(false);
    setCredentials(null);
    setCopiedEmail(false);
    setCopiedPassword(false);
  }

  function handleOpenChange(val: boolean) {
    setOpen(val);
    if (!val) resetForm();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName || undefined,
          tier,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create user");
        return;
      }
      setCredentials(data.data);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard(text: string, type: "email" | "password") {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "email") {
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2000);
      } else {
        setCopiedPassword(true);
        setTimeout(() => setCopiedPassword(false), 2000);
      }
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  function handleDone() {
    setOpen(false);
    resetForm();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Create User
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
        </DialogHeader>

        {credentials ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              User created. Share these credentials with them. The password cannot be recovered.
            </p>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <div className="flex items-center gap-2">
                  <Input value={credentials.email} readOnly className="font-mono text-sm" />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(credentials.email, "email")}
                  >
                    {copiedEmail ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Password</Label>
                <div className="flex items-center gap-2">
                  <Input value={credentials.password} readOnly className="font-mono text-sm" />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(credentials.password, "password")}
                  >
                    {copiedPassword ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <Button className="w-full" onClick={handleDone}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cu-full-name">Full name (optional)</Label>
              <Input
                id="cu-full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Smith"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cu-email">Email</Label>
              <Input
                id="cu-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cu-password">Password</Label>
              <div className="relative">
                <Input
                  id="cu-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cu-tier">Tier</Label>
              <select
                id="cu-tier"
                value={tier}
                onChange={(e) => setTier(e.target.value as "free" | "paid")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="free">Free</option>
                <option value="paid">Pro</option>
              </select>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating…" : "Create User"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
