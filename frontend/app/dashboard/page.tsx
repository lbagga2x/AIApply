"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isAuthenticated, signOut } from "@/lib/auth";
import { getApplications } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type AppStatus =
  | "pending" | "matching" | "tailoring" | "review"
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
  { key: "matching",  label: "🔍 Matching",  colour: "bg-blue-50 border-blue-200" },
  { key: "tailoring", label: "✏️ Tailoring",  colour: "bg-purple-50 border-purple-200" },
  { key: "review",    label: "👁 Review",     colour: "bg-yellow-50 border-yellow-200" },
  { key: "submitted", label: "📤 Submitted",  colour: "bg-gray-50 border-gray-200" },
  { key: "interview", label: "🗓 Interview",  colour: "bg-green-50 border-green-200" },
  { key: "offer",     label: "🎉 Offer",      colour: "bg-emerald-50 border-emerald-200" },
];

// Mock data so the dashboard looks great even before Lambda is wired up
const MOCK_APPS: Application[] = [
  { applicationId: "1", status: "tailoring", companyName: "Stripe", jobTitle: "Senior Software Engineer", matchScore: 94, careerAlignmentScore: 91 },
  { applicationId: "2", status: "review",    companyName: "Notion",  jobTitle: "Platform Engineer",        matchScore: 87, careerAlignmentScore: 85 },
  { applicationId: "3", status: "submitted", companyName: "Linear",  jobTitle: "Staff Engineer",           matchScore: 82, careerAlignmentScore: 89 },
  { applicationId: "4", status: "interview", companyName: "Figma",   jobTitle: "Full-Stack Engineer",      matchScore: 91, careerAlignmentScore: 88 },
  { applicationId: "5", status: "matching",  companyName: "Vercel",  jobTitle: "Developer Experience",     matchScore: 79, careerAlignmentScore: 82 },
];

export default function DashboardPage() {
  const router = useRouter();
  const [apps, setApps] = useState<Application[]>(MOCK_APPS);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    isAuthenticated().then((ok) => {
      if (!ok) router.push("/login");
    });
    getApplications()
      .then((data) => {
        if (data.applications?.length > 0) {
          setApps(data.applications);
        } else {
          setIsDemo(true); // API worked but no real apps yet
        }
      })
      .catch((err: unknown) => {
        setIsDemo(true);
        setApiError(err instanceof Error ? err.message : "API unavailable");
      })
      .finally(() => setLoading(false));
  }, [router]);

  const stats = {
    total: apps.length,
    interviews: apps.filter((a) => a.status === "interview" || a.status === "offer").length,
    offers: apps.filter((a) => a.status === "offer").length,
    responseRate: apps.length
      ? Math.round((apps.filter((a) => ["interview","offer","rejected"].includes(a.status)).length / apps.length) * 100)
      : 0,
  };

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
        {/* Demo / API error banner */}
        {isDemo && (
          <div className={`text-sm px-4 py-2.5 rounded-lg border ${apiError ? "bg-red-50 border-red-200 text-red-700" : "bg-yellow-50 border-yellow-200 text-yellow-800"}`}>
            {apiError
              ? <>⚠️ API error: <code className="font-mono text-xs">{apiError}</code> — showing demo data</>
              : "👋 No applications yet — showing demo data. Upload your CV to get started."}
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
                        <Link key={app.applicationId} href={`/applications/${app.applicationId}`}>
                          <div className="bg-white rounded-md p-2.5 border shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                            <p className="text-xs font-semibold truncate">{app.companyName}</p>
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

        {/* Activity feed */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Recent Activity</h2>
          <div className="space-y-2">
            {[
              { icon: "✏️", text: "Tailored CV for Stripe — Senior Software Engineer", time: "2 min ago" },
              { icon: "🔍", text: "Found 8 new job matches based on your career goals", time: "1 hour ago" },
              { icon: "📤", text: "Applied to Linear — Staff Engineer", time: "3 hours ago" },
              { icon: "🗓", text: "Interview scheduled with Figma — Full-Stack Engineer", time: "Yesterday" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 text-sm p-3 rounded-lg bg-muted/40">
                <span>{item.icon}</span>
                <span className="flex-1">{item.text}</span>
                <span className="text-muted-foreground text-xs whitespace-nowrap">{item.time}</span>
              </div>
            ))}
          </div>
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
