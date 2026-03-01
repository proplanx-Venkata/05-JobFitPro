"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function JdForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleUrlSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    const res = await fetch("/api/jds", {
      method: "POST",
      body: form,
    });
    const data = await res.json();

    if (!res.ok) {
      toast.error(data.error ?? "Failed to add job description");
      setLoading(false);
      return;
    }

    toast.success("Job description added!");
    router.push(`/jds/${data.data.id}`);
    router.refresh();
  }

  async function handleFileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    const res = await fetch("/api/jds", {
      method: "POST",
      body: form,
    });
    const data = await res.json();

    if (!res.ok) {
      toast.error(data.error ?? "Failed to upload job description");
      setLoading(false);
      return;
    }

    toast.success("Job description uploaded!");
    router.push(`/jds/${data.data.id}`);
    router.refresh();
  }

  return (
    <Tabs defaultValue="url">
      <TabsList className="mb-4">
        <TabsTrigger value="url" className="gap-1.5">
          <Link2 className="h-3.5 w-3.5" />
          URL
        </TabsTrigger>
        <TabsTrigger value="file" className="gap-1.5">
          <Upload className="h-3.5 w-3.5" />
          File
        </TabsTrigger>
      </TabsList>

      <TabsContent value="url">
        <form onSubmit={handleUrlSubmit} className="flex gap-2">
          <Input
            name="url"
            type="url"
            placeholder="https://company.com/jobs/123"
            required
            className="flex-1"
          />
          <Button type="submit" disabled={loading}>
            {loading ? "Adding…" : "Add"}
          </Button>
        </form>
      </TabsContent>

      <TabsContent value="file">
        <form onSubmit={handleFileSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="jd-file">PDF or DOCX (≤ 5 MB, ≤ 5 pages)</Label>
            <Input
              id="jd-file"
              name="file"
              type="file"
              accept=".pdf,.docx"
              required
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Uploading…" : "Upload"}
          </Button>
        </form>
      </TabsContent>
    </Tabs>
  );
}
