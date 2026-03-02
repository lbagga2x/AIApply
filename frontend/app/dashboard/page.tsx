"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isAuthenticated, signOut } from "@/lib/auth";
import { getApplications, deleteApplication } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
}

const STATUS_COLS: { key: AppStatus; label: string; colour: string }[] = [
  { key: "matched",   label: "🎯 Matched",   colour: "bg-orange-50 border-orange-200" },
  { key: "tailoring", label: "✏️ Tailoring",  colour: "bg-purple-50 border-purple-200" },
  { key: "review",    label: "👁 Review",     colour: "bg-yellow-50 border-yellow-200" },
  { key: "submitted", label: "📤 Submitted",  colour: "bg-gray-50 border-gray-200" },
  { key: "interview", label: "🗓 Interview",  colour: "bg-green-50 border-green-200" },
  { key: "offer",     label: "🎉 Offer",      colour: "bg-emerald-50 border-emerald-200" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    isAuthenticated().then((ok) => {
      if (!ok && mounted) router.push("/login");
    });

    getApplications()
      .then((data) => {
        if (mounted && data.applications?.length > 0) {
          setApps(data.applications);
        }
      })
      .catch((err: unknown) => {
        if (mounted) setApiError(err instanceof Error ? err.message : "API unavailable");
      })
      .finally(() => { if (mounted) setLoading(false); });

    return () => { mounted = false; };
  }, [router]);

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

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b sticky top-0 bg-background/80 backdrop-blur z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-lg">AIApply</span>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="font-medium">Dashboard</Link>
            <Link href="/applications" className="text-muted-foreground hover:text-foreground">Applications</Link>
            <Link href="/settings" className="text-muted-foreground hover:text-foreground">Settings</Link>
            <Button variant="outline" size="sm" onClick={handleSignOut}>Sign Out</Button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* API error banner */}
        {apiError && (
          <div className="text-sm px-4 py-2.5 rounded-lg border bg-red-50 border-red-200 text-red-700">
            ⚠️ Could not load applications: <code className="font-mono text-xs">{apiError}</code>
          </div>
        )}

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Applications" value={stats.total} />
          <StatCard label="Interviews" value={stats.interviews} />
          <StatCard label="Offers" value={stats.offers} />
          <StatCard label="Response Rate" value={`${stats.responseRate}%`} />
        </div>

        {/* Quick actions */}
        <div className="flex gap-3">
          <Button asChild>
            <Link href="/onboarding">+ Upload New CV</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/settings">Edit Career Goals</Link>
          </Button>
        </div>

        {/* Kanban board */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Application Pipeline</h2>
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading applications…</p>
          ) : apps.length === 0 && !apiError ? (
            <div className="text-center py-16 text-muted-foreground border rounded-lg bg-muted/20">
              <p className="text-4xl mb-3">🚀</p>
              <p className="font-medium mb-1">Your pipeline is empty</p>
              <p className="text-sm">Jobs will appear here once the AI has found and scored matches for you.</p>
              <p className="text-sm mt-1">This usually takes a few minutes after you save your career goals.</p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-4">
              {STATUS_COLS.map((col) => {
                const colApps = apps.filter((a) => a.status === col.key);
                return (
                  <div key={col.key} className="flex-none w-56">
                    <div className={`rounded-lg border p-3 space-y-2 min-h-40 ${col.colour}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{col.label}</span>
                        <Badge variant="secondary" className="text-xs">{colApps.length}</Badge>
                      </div>
                      {colApps.map((app) => (
                        <Link key={app.applicationId} href={`/applications?id=${app.applicationId}`}>
                          <div className="group relative bg-white rounded-md p-2.5 border shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                            {/* Dismiss button */}
                            <button
                              onClick={(e) => handleDismiss(e, app.applicationId)}
                              disabled={dismissingId === app.applicationId}
                              className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4 rounded-full bg-muted hover:bg-red-100 hover:text-red-600 flex items-center justify-center text-muted-foreground text-[10px] leading-none"
                              title="Dismiss"
                            >
                              {dismissingId === app.applicationId ? "…" : "×"}
                            </button>
                            <p className="text-xs font-semibold truncate pr-4">{app.companyName}</p>
                            <p className="text-xs text-muted-foreground truncate">{app.jobTitle}</p>
                            {app.matchScore && (
                              <div className="flex gap-1 mt-1">
                                <Badge variant="outline" className="text-[10px] px-1 py-0">
                                  {app.matchScore}% match
                                </Badge>
                              </div>
                            )}
                          </div>
                        </Link>
                      ))}
                      {colApps.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center pt-4">Empty</p>
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

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-xs text-muted-foreground font-normal">{label}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
