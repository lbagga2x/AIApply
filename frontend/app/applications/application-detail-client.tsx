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
import { getApplications, approveApplication, getTailoredCV, deleteApplication } from "@/lib/api";

interface Change {
  type: "added" | "modified" | "removed";
  section?: string;
  description: string;
}

interface ExperienceEntry {
  title?: string;
  company?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  highlights?: string[];
}

interface EducationEntry {
  degree?: string;
  institution?: string;
  year?: string;
  field?: string;
}

interface TailoredCV {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  summary?: string;
  skills?: string[];
  experience?: ExperienceEntry[];
  education?: EducationEntry[];
  certifications?: string[];
}

interface ApplicationDetail {
  applicationId: string;
  status: string;
  companyName?: string;
  jobTitle?: string;
  matchScore?: string | number;
  careerAlignmentScore?: string | number;
  matchReason?: string;
  cvChanges?: string;
  tailoredCvKey?: string;
  atsScore?: string | number;
  coverLetter?: string;
  jobUrl?: string;
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
  const [tailoredCV, setTailoredCV] = useState<TailoredCV | null>(null);
  const [loading, setLoading] = useState(true);
  const [cvLoading, setCvLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      if (!id) { router.replace("/dashboard"); return; }

      const ok = await isAuthenticated();
      if (!mounted) return;
      if (!ok) { router.push("/login"); return; }

      try {
        const data = await getApplications();
        const found = (data.applications || []).find(
          (a: ApplicationDetail) => a.applicationId === id
        );
        if (!mounted) return;
        if (found) {
          setApp(found);
          // Auto-fetch tailored CV if it's ready
          if (found.tailoredCvKey) {
            fetchTailoredCV(id);
          }
        } else {
          setError("Application not found");
        }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => { mounted = false; };
  }, [id, router]);

  async function fetchTailoredCV(applicationId: string) {
    setCvLoading(true);
    try {
      const data = await getTailoredCV(applicationId);
      setTailoredCV(data.tailoredCV);
    } catch {
      // non-fatal — CV tab just won't show
    } finally {
      setCvLoading(false);
    }
  }

  async function handleDelete() {
    if (!app || deleting) return;
    if (!confirm(`Remove this application for ${app.companyName || "this company"} from your pipeline?`)) return;
    setDeleting(true);
    try {
      await deleteApplication(app.applicationId);
      router.push("/dashboard");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not delete. Please try again.");
      setDeleting(false);
    }
  }

  async function handleApprove() {
    if (!app || approving) return;
    setApproving(true);
    setApproveError("");
    try {
      await approveApplication(app.applicationId);
      setApp((prev) => prev ? { ...prev, status: "submitted" } : prev);
    } catch (err) {
      setApproveError(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setApproving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading application…</p>
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{error || "Application not found"}</p>
        <Button asChild variant="outline"><Link href="/dashboard">← Back to Dashboard</Link></Button>
      </div>
    );
  }

  let changes: Change[] = [];
  if (app.cvChanges) {
    try { changes = JSON.parse(app.cvChanges); } catch { changes = []; }
  }

  const matchScore     = Number(app.matchScore) || 0;
  const alignmentScore = Number(app.careerAlignmentScore) || 0;
  const atsScore       = Number(app.atsScore) || 0;
  const statusLabel    = STATUS_LABELS[app.status] ?? app.status;
  const canApprove     = app.status === "review";
  const isSubmitted    = app.status === "submitted";

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
          <Badge className="ml-auto" variant={isSubmitted ? "default" : "secondary"}>
            {statusLabel}
          </Badge>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-2 gap-6">

          {/* ── Left: scores + reason + cover letter ── */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{app.jobTitle || "Role"}</CardTitle>
                    <p className="text-muted-foreground font-medium">{app.companyName || "Company"}</p>
                  </div>
                  <div className="text-right text-sm space-y-1">
                    {matchScore > 0 && <Badge variant="secondary">{matchScore}% match</Badge>}
                    <div />
                    {alignmentScore > 0 && <Badge variant="outline">{alignmentScore}% career fit</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="alignment">
                  <TabsList className="mb-3">
                    <TabsTrigger value="alignment">Why You</TabsTrigger>
                    {app.coverLetter && <TabsTrigger value="cover">Cover Letter</TabsTrigger>}
                  </TabsList>
                  <TabsContent value="alignment" className="text-sm leading-relaxed">
                    <p className="text-muted-foreground">
                      {app.matchReason || "Match reasoning not yet available."}
                    </p>
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
                disabled={!canApprove || approving}
                onClick={handleApprove}
              >
                {approving ? "Saving…" : isSubmitted ? "✓ CV Approved" : "✓ Approve CV"}
              </Button>
              <Button variant="ghost" onClick={() => router.push("/dashboard")}>← Back</Button>
              {!isSubmitted && (
                <Button
                  variant="outline"
                  className="text-muted-foreground hover:text-red-600 hover:border-red-300"
                  disabled={deleting}
                  onClick={handleDelete}
                >
                  {deleting ? "Removing…" : "Not Interested"}
                </Button>
              )}
            </div>

            {approveError && (
              <p className="text-xs text-red-600 text-center">{approveError}</p>
            )}

            {/* After approving: show the Apply link */}
            {isSubmitted && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 space-y-2">
                <p className="text-sm font-medium text-green-800">✓ CV approved — now apply manually</p>
                <p className="text-xs text-green-700">
                  Auto-submit is coming in a future update. For now, copy your tailored CV from
                  the &quot;Tailored CV&quot; tab and apply directly on the company&apos;s site.
                </p>
                {app.jobUrl && (
                  <a
                    href={app.jobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-green-900 underline underline-offset-2 hover:text-green-700"
                  >
                    Apply at {app.companyName} ↗
                  </a>
                )}
              </div>
            )}

            {!canApprove && !isSubmitted && (
              <p className="text-xs text-muted-foreground text-center">
                {app.status === "tailoring"
                  ? "✏️ AI is tailoring your CV — usually takes 1–2 minutes. Refresh to check."
                  : "Button unlocks once the CV has been tailored and is ready for review."}
              </p>
            )}

            {/* Metadata */}
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
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Right: changes + tailored CV + ATS ── */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Your Tailored Application</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {tailoredCV
                    ? "Review the changes and the full rewritten CV below"
                    : app.status === "tailoring"
                    ? "Tailoring in progress — check back in a moment"
                    : "CV not yet tailored"}
                </p>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="changes">
                  <TabsList className="mb-3">
                    <TabsTrigger value="changes">Changes ({changes.length})</TabsTrigger>
                    {(tailoredCV || cvLoading) && (
                      <TabsTrigger value="cv">Tailored CV</TabsTrigger>
                    )}
                  </TabsList>

                  {/* Changes tab */}
                  <TabsContent value="changes" className="space-y-2">
                    {changes.length > 0 ? (
                      changes.map((change, i) => (
                        <div
                          key={i}
                          className={`flex items-start gap-2 text-sm px-3 py-2 rounded border ${CHANGE_COLOURS[change.type] ?? ""}`}
                        >
                          <span className="font-semibold capitalize whitespace-nowrap">{change.type}</span>
                          <span>{change.description}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground py-2">
                        {app.status === "tailoring" ? "⏳ Check back in a moment…" : "—"}
                      </p>
                    )}
                  </TabsContent>

                  {/* Full tailored CV tab */}
                  {(tailoredCV || cvLoading) && (
                    <TabsContent value="cv">
                      {cvLoading ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">Loading CV…</p>
                      ) : tailoredCV ? (
                        <TailoredCVView cv={tailoredCV} />
                      ) : null}
                    </TabsContent>
                  )}
                </Tabs>
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
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">→</span>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Tailored ATS</p>
                    <p className="text-2xl font-bold text-green-600">{atsScore}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}

/* ── Tailored CV renderer ── */
function TailoredCVView({ cv }: { cv: TailoredCV }) {
  return (
    <div className="space-y-4 text-sm max-h-[60vh] overflow-y-auto pr-1">
      {/* Header */}
      <div className="pb-3 border-b">
        <h3 className="text-base font-bold">{cv.name}</h3>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
          {cv.email    && <span>{cv.email}</span>}
          {cv.phone    && <span>{cv.phone}</span>}
          {cv.location && <span>{cv.location}</span>}
        </div>
      </div>

      {/* Summary */}
      {cv.summary && (
        <div>
          <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-1">Summary</h4>
          <p className="leading-relaxed text-foreground">{cv.summary}</p>
        </div>
      )}

      {/* Skills */}
      {cv.skills && cv.skills.length > 0 && (
        <div>
          <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">Skills</h4>
          <div className="flex flex-wrap gap-1.5">
            {cv.skills.map((s, i) => (
              <span key={i} className="px-2 py-0.5 bg-muted rounded text-xs">{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* Experience */}
      {cv.experience && cv.experience.length > 0 && (
        <div>
          <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">Experience</h4>
          <div className="space-y-3">
            {cv.experience.map((exp, i) => (
              <div key={i}>
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold">{exp.title}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                    {exp.startDate}{exp.endDate ? ` – ${exp.endDate}` : ""}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-1">{exp.company}</p>
                {exp.description && <p className="text-muted-foreground leading-relaxed">{exp.description}</p>}
                {exp.highlights && exp.highlights.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {exp.highlights.map((h, j) => (
                      <li key={j} className="flex gap-1.5 text-muted-foreground">
                        <span className="mt-1 shrink-0">•</span>
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Education */}
      {cv.education && cv.education.length > 0 && (
        <div>
          <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">Education</h4>
          <div className="space-y-1">
            {cv.education.map((edu, i) => (
              <div key={i}>
                <span className="font-semibold">{edu.degree}</span>
                {edu.field && <span className="text-muted-foreground"> · {edu.field}</span>}
                <p className="text-xs text-muted-foreground">{edu.institution}{edu.year ? `, ${edu.year}` : ""}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Certifications */}
      {cv.certifications && cv.certifications.length > 0 && (
        <div>
          <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">Certifications</h4>
          <ul className="space-y-0.5">
            {cv.certifications.map((c, i) => (
              <li key={i} className="flex gap-1.5 text-muted-foreground">
                <span>•</span><span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
