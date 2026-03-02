"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { isAuthenticated } from "@/lib/auth";
import { getApplications } from "@/lib/api";

interface Change {
  type: "added" | "modified" | "removed";
  section?: string;
  description: string;
}

interface ApplicationDetail {
  applicationId: string;
  userId: string;
  jobId?: string;
  cvId?: string;
  status: string;
  companyName?: string;
  jobTitle?: string;
  matchScore?: string | number;
  careerAlignmentScore?: string | number;
  matchReason?: string;
  cvChanges?: string; // JSON string stored by cv_tailor
  tailoredCvKey?: string;
  atsScore?: string | number;
  coverLetter?: string;
  createdAt?: string;
}

const CHANGE_COLOURS: Record<string, string> = {
  added:    "text-green-700 bg-green-50 border-green-200",
  modified: "text-yellow-700 bg-yellow-50 border-yellow-200",
  removed:  "text-red-700 bg-red-50 border-red-200",
};

const STATUS_LABELS: Record<string, string> = {
  pending:   "Pending",
  matching:  "Matching",
  tailoring: "Tailoring CV…",
  review:    "Ready for review",
  submitted: "Submitted",
  interview: "Interview",
  offer:     "Offer",
  rejected:  "Rejected",
};

export default function ApplicationDetailClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");

  const [app, setApp] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      // No ID → go back to dashboard
      if (!id) {
        router.replace("/dashboard");
        return;
      }

      // Auth check — fetchAuthSession auto-refreshes expired tokens
      const ok = await isAuthenticated();
      if (!mounted) return;
      if (!ok) {
        router.push("/login");
        return;
      }

      // Fetch all applications then find the matching one
      try {
        const data = await getApplications();
        const apps: ApplicationDetail[] = data.applications || [];
        const found = apps.find((a) => a.applicationId === id);
        if (!mounted) return;
        if (found) {
          setApp(found);
        } else {
          setError("Application not found");
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load application");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => { mounted = false; };
  }, [id, router]);

  // --- Loading ---
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading application…</p>
      </div>
    );
  }

  // --- Error / not found ---
  if (error || !app) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{error || "Application not found"}</p>
        <Button asChild variant="outline">
          <Link href="/dashboard">← Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  // Parse cvChanges (stored as JSON string by cv_tailor Lambda)
  let changes: Change[] = [];
  if (app.cvChanges) {
    try {
      changes = JSON.parse(app.cvChanges);
    } catch {
      changes = [];
    }
  }

  const matchScore = Number(app.matchScore) || 0;
  const alignmentScore = Number(app.careerAlignmentScore) || 0;
  const atsScore = Number(app.atsScore) || 0;
  const statusLabel = STATUS_LABELS[app.status] ?? app.status;

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b sticky top-0 bg-background/80 backdrop-blur z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            ← Dashboard
          </Link>
          <Separator orientation="vertical" className="h-5" />
          <span className="font-semibold">
            {app.companyName || "Company"} — {app.jobTitle || "Role"}
          </span>
          <Badge className="ml-auto">{statusLabel}</Badge>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-2 gap-6">

          {/* Left: scores + match reason + cover letter */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{app.jobTitle || "Role"}</CardTitle>
                    <p className="text-muted-foreground font-medium">{app.companyName || "Company"}</p>
                  </div>
                  <div className="text-right text-sm space-y-1">
                    {matchScore > 0 && (
                      <Badge variant="secondary">{matchScore}% match</Badge>
                    )}
                    <div />
                    {alignmentScore > 0 && (
                      <Badge variant="outline">{alignmentScore}% career fit</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="alignment">
                  <TabsList className="mb-3">
                    <TabsTrigger value="alignment">Why You</TabsTrigger>
                    {app.coverLetter && (
                      <TabsTrigger value="cover">Cover Letter</TabsTrigger>
                    )}
                  </TabsList>

                  <TabsContent value="alignment" className="text-sm leading-relaxed">
                    {app.matchReason ? (
                      <p className="text-muted-foreground">{app.matchReason}</p>
                    ) : (
                      <p className="text-muted-foreground italic">
                        Match reasoning not yet available.
                      </p>
                    )}
                  </TabsContent>

                  {app.coverLetter && (
                    <TabsContent
                      value="cover"
                      className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto"
                    >
                      {app.coverLetter}
                    </TabsContent>
                  )}
                </Tabs>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                className="flex-1"
                disabled={app.status !== "review"}
                title={
                  app.status !== "review"
                    ? "CV tailoring must complete before you can approve"
                    : ""
                }
              >
                ✓ Approve &amp; Submit
              </Button>
              <Button variant="ghost" onClick={() => router.push("/dashboard")}>
                ← Back
              </Button>
            </div>

            {app.status === "tailoring" && (
              <p className="text-xs text-muted-foreground text-center">
                ✏️ AI is tailoring your CV for this role — usually takes 1–2 minutes.
                Refresh to check for updates.
              </p>
            )}
          </div>

          {/* Right: CV changes + ATS score + metadata */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  CV Changes for {app.companyName || "this role"}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {changes.length > 0
                    ? "What we tailored to match this role and company"
                    : app.status === "tailoring"
                    ? "Tailoring in progress — changes will appear shortly"
                    : "No tailoring changes recorded yet"}
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {changes.length > 0 ? (
                  changes.map((change, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 text-sm px-3 py-2 rounded border ${
                        CHANGE_COLOURS[change.type] ?? ""
                      }`}
                    >
                      <span className="font-semibold capitalize whitespace-nowrap">
                        {change.type}
                      </span>
                      <span>{change.description}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground py-2">
                    {app.status === "tailoring" ? "⏳ Check back in a moment…" : "—"}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* ATS Score */}
            {atsScore > 0 && (
              <Card>
                <CardContent className="pt-4 pb-4 flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Original ATS</p>
                    <p className="text-2xl font-bold text-muted-foreground">—</p>
                  </div>
                  <div className="flex-1 h-px bg-border relative">
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
                      →
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Tailored ATS</p>
                    <p className="text-2xl font-bold text-green-600">{atsScore}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Application metadata */}
            <Card>
              <CardContent className="pt-4 pb-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Status</p>
                  <p className="font-medium">{statusLabel}</p>
                </div>
                {app.createdAt && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Found</p>
                    <p className="font-medium">
                      {new Date(app.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
