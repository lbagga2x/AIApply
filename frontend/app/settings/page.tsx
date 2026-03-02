"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isAuthenticated } from "@/lib/auth";
import { getCareerGoals, saveCareerGoals, scanJobs } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const WORK_ARRANGEMENTS = ["Remote", "Hybrid", "On-site"];

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

export default function SettingsPage() {
  const router = useRouter();
  const [targetRoles, setTargetRoles] = useState("");
  const [minSalary, setMinSalary] = useState("");
  const [maxSalary, setMaxSalary] = useState("");
  const [locations, setLocations] = useState("");
  const [arrangement, setArrangement] = useState<string[]>(["Remote"]);
  const [autoApply, setAutoApply] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanDone, setScanDone] = useState(false);
  const [lastScannedAt, setLastScannedAt] = useState<string | null>(null);

  useEffect(() => {
    isAuthenticated().then((ok) => { if (!ok) router.push("/login"); });
    getCareerGoals().then((data) => {
      const g = data.careerGoals ?? {};
      setTargetRoles((g.targetRoles ?? []).join(", "));
      setMinSalary(g.minSalary ?? "");
      setMaxSalary(g.maxSalary ?? "");
      setLocations((g.locations ?? []).join(", "));
      setArrangement(g.workArrangement ?? ["Remote"]);
      setLastScannedAt(data.lastScannedAt ?? null);
    }).catch(() => {});
  }, [router]);

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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await saveCareerGoals({
        targetRoles: targetRoles.split(",").map((r) => r.trim()).filter(Boolean),
        minSalary: minSalary ? Number(minSalary) : null,
        maxSalary: maxSalary ? Number(maxSalary) : null,
        locations: locations.split(",").map((l) => l.trim()).filter(Boolean),
        workArrangement: arrangement,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">← Dashboard</Link>
          <Separator orientation="vertical" className="h-5" />
          <span className="font-semibold">Settings</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Career Goals */}
        <Card>
          <CardHeader>
            <CardTitle>Career Goals</CardTitle>
            <CardDescription>Update what you&apos;re looking for — affects all future job matching</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1">
                <Label>Target Job Titles</Label>
                <Input placeholder="Senior Software Engineer, Tech Lead" value={targetRoles} onChange={(e) => setTargetRoles(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Min Salary</Label>
                  <Input type="number" placeholder="60000" value={minSalary} onChange={(e) => setMinSalary(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Max Salary</Label>
                  <Input type="number" placeholder="120000" value={maxSalary} onChange={(e) => setMaxSalary(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Preferred Locations</Label>
                <Input placeholder="London, Remote UK" value={locations} onChange={(e) => setLocations(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Work Arrangement</Label>
                <div className="flex gap-2">
                  {WORK_ARRANGEMENTS.map((wa) => (
                    <Badge key={wa} variant={arrangement.includes(wa) ? "default" : "outline"} className="cursor-pointer"
                      onClick={() => setArrangement((p) => p.includes(wa) ? p.filter((a) => a !== wa) : [...p, wa])}>
                      {wa}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button type="submit" disabled={saving}>
                {saved ? "✓ Saved!" : saving ? "Saving…" : "Save Changes"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Job Scout */}
        <Card>
          <CardHeader>
            <CardTitle>Job Scout</CardTitle>
            <CardDescription>
              Scan LinkedIn &amp; Indeed for new jobs matching your career goals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                {lastScannedAt
                  ? `Last scanned: ${formatRelativeTime(lastScannedAt)}`
                  : "Never scanned — run a scan after saving your career goals"}
              </div>
              <Button onClick={handleScan} disabled={scanning} variant="outline" className="shrink-0">
                {scanning ? "🔍 Scanning…" : "🔍 Scan for New Jobs Now"}
              </Button>
            </div>
            {scanDone && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                ✓ Scan started — new matches will appear in your dashboard in a few minutes.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Each scan costs ~$0.07 in AI credits (Haiku model scores 30 jobs).
              Run it daily for fresh results.
            </p>
          </CardContent>
        </Card>

        {/* Auto-apply */}
        <Card>
          <CardHeader>
            <CardTitle>Application Mode</CardTitle>
            <CardDescription>Choose how applications are submitted</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="radio" name="mode" checked={!autoApply} onChange={() => setAutoApply(false)} className="mt-1" />
              <div>
                <p className="font-medium">Review First (Recommended)</p>
                <p className="text-sm text-muted-foreground">You approve each tailored CV before it&apos;s submitted</p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="radio" name="mode" checked={autoApply} onChange={() => setAutoApply(true)} className="mt-1" />
              <div>
                <p className="font-medium">Auto Apply</p>
                <p className="text-sm text-muted-foreground">Applications submit automatically after tailoring. You can review afterwards.</p>
              </div>
            </label>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
