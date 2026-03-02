import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Upload,
  BrainCircuit,
  FileText,
  Star,
  Zap,
} from "lucide-react";

export default async function LandingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* ── Nav ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-bold text-lg tracking-tight">JobFit Pro</span>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/signup">Get started free</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="py-24 px-6 text-center">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border bg-neutral-50 px-3 py-1 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Now in alpha
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
              Get past the ATS.<br className="hidden sm:block" /> Land more interviews.
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              JobFit Pro tailors your resume to each job description — without
              fabricating a single line. Powered by AI, guided by you.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button size="lg" asChild>
                <Link href="/signup">Get started free</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#how-it-works">See how it works</a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Free forever · No credit card required
            </p>
          </div>
        </section>

        {/* ── How it works ───────────────────────────────────────── */}
        <section id="how-it-works" className="py-20 px-6 bg-neutral-50">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold">How it works</h2>
              <p className="text-muted-foreground mt-2">
                Four steps from your resume to an ATS-optimized application.
              </p>
            </div>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: Upload,
                  step: "1",
                  title: "Upload your resume",
                  desc: "PDF or DOCX. Parsed once, reused forever.",
                },
                {
                  icon: FileText,
                  step: "2",
                  title: "Add a job description",
                  desc: "Paste a URL or upload the JD file. We strip the boilerplate.",
                },
                {
                  icon: BrainCircuit,
                  step: "3",
                  title: "AI interviews you",
                  desc: "We find your gaps and ask targeted questions — no fabrication.",
                },
                {
                  icon: Star,
                  step: "4",
                  title: "Download your package",
                  desc: "ATS-optimized resume, cover letter, and your score. PDF + DOCX.",
                },
              ].map(({ icon: Icon, step, title, desc }) => (
                <div key={step} className="relative bg-white rounded-xl border p-6 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                      {step}
                    </div>
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="font-semibold text-sm">{title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ────────────────────────────────────────────── */}
        <section id="pricing" className="py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold">Simple pricing</h2>
              <p className="text-muted-foreground mt-2">
                Start free. Upgrade when you need more applications.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              {/* Free */}
              <div className="rounded-2xl border p-8 space-y-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Free</p>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-bold">$0</span>
                    <span className="text-muted-foreground text-sm">/ forever</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Perfect for trying out the platform.
                  </p>
                </div>
                <ul className="space-y-2.5 text-sm">
                  {[
                    "2 tailored resumes (total)",
                    "Gap analysis per JD",
                    "AI clarification interview",
                    "ATS score with gap breakdown",
                    "PDF + DOCX download",
                    "Cover letter generation",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/signup">Get started free</Link>
                </Button>
              </div>

              {/* Pro */}
              <div className="rounded-2xl border-2 border-primary p-8 space-y-6 relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                    <Zap className="h-3 w-3" /> Most popular
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Pro</p>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-bold">$9.99</span>
                    <span className="text-muted-foreground text-sm">/ month</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    For active job seekers sending multiple applications.
                  </p>
                </div>
                <ul className="space-y-2.5 text-sm">
                  {[
                    "30 tailored resumes per month",
                    "Everything in Free",
                    "Monthly quota reset",
                    "Priority processing",
                    "Early access to new features",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full" asChild>
                  <Link href="/signup">Start free, upgrade anytime</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">JobFit Pro</span>
          <span>© {new Date().getFullYear()} JobFit Pro. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-foreground transition-colors">Sign in</Link>
            <Link href="/signup" className="hover:text-foreground transition-colors">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
