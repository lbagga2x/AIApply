"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isAuthenticated, signOut } from "@/lib/auth";
import { getApplications, deleteApplication, scanJobs, getCareerGoals, createManualApplication } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Briefcase, MessageSquare, Award, TrendingUp } from "lucide-react";

type AppStatus =
  | "pending" | "matched" | "matching" | "tailoring" | "review"
  | "submitted" | "interview" | "offer" | "rejected";

interface Application {
  applicationId: string;
  status: AppStatus;
  companyName?: string;
  jobTitle?: string;
  matchScore?: number;
  careerAlignmentScore?: number;
  createdAt?: string;
  source?: string;
  jobLocation?: string;
}

const MANUAL_STATUS_OPTIONS: { key: AppStatus; label: string }[] = [
  { key: "matched", label: "Matched" },
  { key: "review", label: "Review" },
  { key: "submitted", label: "Submitted" },
  { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" },
  { key: "rejected", label: "Rejected" },
];

const STATUS_COLS: {
  key: AppStatus;
  label: string;
  emoji: string;
  colour: string;
  accent: string;
}[] = [
  {
    key: "matched",
    label: "Matched",
    emoji: "🎯",
    colour: "bg-amber-50/80 border-amber-200/80 dark:bg-amber-950/40 dark:border-amber-700/50",
    accent: "bg-amber-400 dark:bg-amber-500",
  },
  {
    key: "tailoring",
    label: "Tailoring",
    emoji: "✏️",
    colour: "bg-violet-50/80 border-violet-200/80 dark:bg-violet-950/40 dark:border-violet-700/50",
    accent: "bg-violet-400 dark:bg-violet-500",
  },
  {
    key: "review",
    label: "Review",
    emoji: "👁",
    colour: "bg-sky-50/80 border-sky-200/80 dark:bg-sky-950/40 dark:border-sky-700/50",
    accent: "bg-sky-400 dark:bg-sky-500",
  },
  {
    key: "submitted",
    label: "Submitted",
    emoji: "📤",
    colour: "bg-slate-50/80 border-slate-200/80 dark:bg-slate-800/50 dark:border-slate-600/50",
    accent: "bg-slate-400 dark:bg-slate-500",
  },
  {
    key: "interview",
    label: "Interview",
    emoji: "🗓",
    colour: "bg-emerald-50/80 border-emerald-200/80 dark:bg-emerald-950/40 dark:border-emerald-700/50",
    accent: "bg-emerald-400 dark:bg-emerald-500",
  },
  {
    key: "offer",
    label: "Offer",
    emoji: "🎉",
    colour: "bg-green-50/80 border-green-200/80 dark:bg-green-950/40 dark:border-green-700/50",
    accent: "bg-green-400 dark:bg-green-500",
  },
  {
    key: "rejected",
    label: "Rejected",
    emoji: "✖",
    colour: "bg-red-50/80 border-red-200/80 dark:bg-red-950/40 dark:border-red-700/50",
    accent: "bg-red-400 dark:bg-red-500",
  },
];

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanDone, setScanDone] = useState(false);
  const [lastScannedAt, setLastScannedAt] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState("");
  const [manualCompany, setManualCompany] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualStatus, setManualStatus] = useState<AppStatus>("submitted");

  useEffect(() => {
    let mounted = true;

    async function init() {
      const ok = await isAuthenticated();
      if (!mounted) return;
      if (!ok) { router.push("/login"); return; }
      setAuthChecked(true);

      // Fetch applications and last-scanned time in parallel
      Promise.all([
        getApplications().catch((err: unknown) => {
          if (mounted) setApiError(err instanceof Error ? err.message : "API unavailable");
          return null;
        }),
        getCareerGoals().catch(() => null),
      ]).then(([appsData, goalsData]) => {
        if (!mounted) return;
        if (appsData?.applications?.length > 0) setApps(appsData.applications);
        if (goalsData?.lastScannedAt) setLastScannedAt(goalsData.lastScannedAt);
      }).finally(() => { if (mounted) setLoading(false); });
    }

    init();
    return () => { mounted = false; };
  }, [router]);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  const stats = {
    total: apps.length,
    interviews: apps.filter((a) => a.status === "interview" || a.status === "offer").length,
    offers: apps.filter((a) => a.status === "offer").length,
    responseRate: apps.length
      ? Math.round((apps.filter((a) => ["interview","offer","rejected"].includes(a.status)).length / apps.length) * 100)
      : 0,
  };

  async function handleDismiss(e: React.MouseEvent, applicationId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Remove this application from your pipeline?")) return;
    setDismissingId(applicationId);
    try {
      await deleteApplication(applicationId);
      setApps((prev) => prev.filter((a) => a.applicationId !== applicationId));
    } catch {
      alert("Could not delete application. Please try again.");
    } finally {
      setDismissingId(null);
    }
  }

  async function handleScan() {
    setScanning(true);
    setScanDone(false);
    try {
      await scanJobs();
      setScanDone(true);
      setLastScannedAt(new Date().toISOString());
    } catch (err) {
      alert(err instanceof Error ? err.message : "Scan failed. Please try again.");
    } finally {
      setScanning(false);
    }
  }

  async function handleCreateManual() {
    if (manualSaving) return;
    if (!manualCompany.trim() && !manualTitle.trim()) {
      setManualError("Please enter at least a company name or a job title.");
      return;
    }
    if (!manualUrl.trim()) {
      setManualError("Please enter the job link.");
      return;
    }
    setManualSaving(true);
    setManualError("");
    try {
      const status =
        (["matched", "review", "submitted", "interview", "offer", "rejected"].includes(manualStatus)
          ? manualStatus
          : "submitted") as "matched" | "review" | "submitted" | "interview" | "offer" | "rejected";

      const res = await createManualApplication({
        companyName: manualCompany.trim(),
        jobTitle: manualTitle.trim(),
        jobUrl: manualUrl.trim(),
        status,
      });

      const created: Application | undefined = res?.application;
      if (created) {
        setApps((prev) => [created, ...prev]);
      } else {
        const data = await getApplications();
        setApps(data.applications || []);
      }

      setManualCompany("");
      setManualTitle("");
      setManualUrl("");
      setManualStatus("submitted");
      setManualOpen(false);
    } catch (err) {
      setManualError(err instanceof Error ? err.message : "Could not save manual application.");
    } finally {
      setManualSaving(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  return (
    <div className="min-h-screen bg-background">

      {/* ── Nav ── */}
      <header className="border-b border-border/60 sticky top-0 bg-background/80 backdrop-blur-xl z-10">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-sm">
              <span className="text-primary-foreground text-[11px] font-bold tracking-tight">AI</span>
            </div>
            <span className="font-semibold text-[15px] tracking-tight">AIApply</span>
          </div>

          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded-lg font-medium text-foreground bg-accent text-accent-foreground text-[13px]"
            >
              Dashboard
            </Link>
            <Link
              href="/settings"
              className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-[13px]"
            >
              Settings
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="ml-2 h-8 text-[13px] border-border/60"
            >
              Sign out
            </Button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ── API error ── */}
        {apiError && (
          <div className="text-sm px-4 py-3 rounded-xl border bg-destructive/5 border-destructive/20 text-destructive flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span>Could not load applications: <code className="font-mono text-xs opacity-80">{apiError}</code></span>
          </div>
        )}

        {/* ── Stats bar ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total" value={stats.total}       icon={Briefcase}     accent="bg-primary/10 text-primary" />
          <StatCard label="Interviews" value={stats.interviews} icon={MessageSquare}  accent="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" />
          <StatCard label="Offers"     value={stats.offers}     icon={Award}         accent="bg-amber-500/10 text-amber-600 dark:text-amber-400" />
          <StatCard label="Response Rate" value={`${stats.responseRate}%`} icon={TrendingUp} accent="bg-violet-500/10 text-violet-600 dark:text-violet-400" />
        </div>

        {/* ── Actions ── */}
        <div className="space-y-3">
          <div className="flex gap-2.5 flex-wrap items-center">
            <Button asChild className="h-9 text-[13px] shadow-sm">
              <Link href="/onboarding">
                <span className="mr-1.5">+</span> Upload New CV
              </Link>
            </Button>
            <Dialog open={manualOpen} onOpenChange={setManualOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-9 text-[13px] border-border/60">
                  ➕ Add manual application
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add manual application</DialogTitle>
                  <DialogDescription>
                    Track a job you found or applied to outside AIApply.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="manual-company">Company</Label>
                    <Input
                      id="manual-company"
                      value={manualCompany}
                      onChange={(e) => setManualCompany(e.target.value)}
                      placeholder="e.g. Stripe"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="manual-title">Job title</Label>
                    <Input
                      id="manual-title"
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      placeholder="e.g. Software Engineer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="manual-url">Job link</Label>
                    <Input
                      id="manual-url"
                      value={manualUrl}
                      onChange={(e) => setManualUrl(e.target.value)}
                      placeholder="https://…"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <div className="flex flex-wrap gap-2">
                      {MANUAL_STATUS_OPTIONS.map((opt) => (
                        <Button
                          key={opt.key}
                          type="button"
                          size="sm"
                          variant={manualStatus === opt.key ? "default" : "outline"}
                          onClick={() => setManualStatus(opt.key)}
                          className="h-8 text-[12px]"
                        >
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {manualError && (
                    <div className="text-sm px-3 py-2 rounded-lg border bg-destructive/5 border-destructive/20 text-destructive">
                      {manualError}
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setManualOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateManual} disabled={manualSaving}>
                    {manualSaving ? "Saving…" : "Add to pipeline"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" asChild className="h-9 text-[13px] border-border/60">
              <Link href="/settings">Edit Career Goals</Link>
            </Button>
            <Button
              variant="outline"
              onClick={handleScan}
              disabled={scanning}
              className="h-9 text-[13px] border-border/60"
            >
              {scanning ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  Scanning…
                </span>
              ) : (
                "🔍 Scan for New Jobs"
              )}
            </Button>
            {/* Last scanned badge */}
            {lastScannedAt && !scanning && (
              <span className="text-[12px] text-muted-foreground">
                Last scanned <span className="font-medium text-foreground">{formatRelativeTime(lastScannedAt)}</span>
              </span>
            )}
          </div>
          {scanDone && (
            <div className="text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl px-4 py-2.5 w-fit flex items-center gap-2">
              <span>✓</span>
              <span>Scan started — new matches will appear in the Matched column in a few minutes.</span>
            </div>
          )}
        </div>

        {/* ── Pipeline ── */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold tracking-tight">Application Pipeline</h2>
            {!loading && apps.length > 0 && (
              <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                {apps.length} application{apps.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex gap-3 overflow-x-auto pb-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex-none w-56 h-48 rounded-2xl bg-muted/50 animate-pulse" />
              ))}
            </div>
          ) : apps.length === 0 && !apiError ? (
            <div className="text-center py-20 border border-dashed border-border/60 rounded-2xl bg-muted/20">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Briefcase className="w-7 h-7 text-primary/60" />
              </div>
              <p className="font-semibold text-foreground mb-1">Pipeline is empty</p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Jobs will appear here once the AI finds and scores matches for you.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Usually takes a few minutes after saving career goals.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-5 text-[13px]"
                onClick={handleScan}
                disabled={scanning}
              >
                🔍 Scan for New Jobs
              </Button>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-4">
              {STATUS_COLS.map((col) => {
                const colApps = apps.filter((a) => a.status === col.key);
                return (
                  <div key={col.key} className="flex-none w-56">
                    {/* Column */}
                    <div className={`rounded-2xl border p-3 flex flex-col gap-3 min-h-44 ${col.colour}`}>
                      {/* Column header */}
                      <div className="flex items-center justify-between px-0.5 mb-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm leading-none">{col.emoji}</span>
                          <span className="text-[11px] font-semibold tracking-wide uppercase text-foreground/70">
                            {col.label}
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold text-muted-foreground bg-background/60 dark:bg-background/30 px-2 py-0.5 rounded-full tabular-nums">
                          {colApps.length}
                        </span>
                      </div>

                      {/* Cards */}
                      {colApps.map((app) => (
                        <Link key={app.applicationId} href={`/applications?id=${app.applicationId}`}>
                          <div className="group relative rounded-xl bg-card border border-border/50 dark:border-white/[0.15] p-3 shadow-sm dark:shadow-[0_2px_12px_rgba(0,0,0,0.6)] hover:shadow-md hover:-translate-y-px transition-all duration-150 cursor-pointer overflow-hidden">

                            {/* Left accent stripe */}
                            <div className={`absolute inset-y-0 left-0 w-[3px] ${col.accent}`} />

                            {/* Dismiss */}
                            <button
                              onClick={(e) => handleDismiss(e, app.applicationId)}
                              disabled={dismissingId === app.applicationId}
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded-full bg-muted hover:bg-destructive/10 hover:text-destructive flex items-center justify-center text-muted-foreground text-xs"
                              title="Dismiss"
                            >
                              {dismissingId === app.applicationId ? "…" : "×"}
                            </button>

                            <div className="pl-2 pr-4">
                              <p className="text-[13px] font-semibold truncate text-foreground leading-tight">
                                {app.companyName || "—"}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                {app.jobTitle || "—"}
                              </p>

                              {app.jobLocation && (
                                <p className="text-[10px] text-muted-foreground/80 mt-1 truncate">
                                  {app.jobLocation}
                                </p>
                              )}
                              <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                                {app.source === "manual" ? "Added manually" : "Found by AI"}
                              </p>

                              {app.matchScore != null && Number(app.matchScore) > 0 && (
                                <div className="mt-2.5 flex items-center gap-2">
                                  <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-primary/60"
                                      style={{ width: `${Number(app.matchScore)}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                                    {app.matchScore}%
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </Link>
                      ))}

                      {colApps.length === 0 && (
                        <div className="flex items-center justify-center py-6">
                          <p className="text-[11px] text-muted-foreground/50">Empty</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}

/* ── Stat Card ───────────────────────────────────────────────── */
function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <Card className="shadow-sm border-border/60">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">
              {label}
            </p>
            <p className="text-2xl font-bold mt-1.5 text-foreground tabular-nums">{value}</p>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
