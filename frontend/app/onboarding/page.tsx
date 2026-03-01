"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getUploadUrl, uploadFileToS3, saveCareerGoals } from "@/lib/api";

type Step = "upload" | "goals" | "done";

const WORK_ARRANGEMENTS = ["Remote", "Hybrid", "On-site"];
const INDUSTRIES = [
  "Tech / Software", "Finance / Fintech", "Healthcare", "E-commerce",
  "Consulting", "Media / Entertainment", "Education", "Government", "Other",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  // Career goals state
  const [targetRoles, setTargetRoles] = useState("");
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [minSalary, setMinSalary] = useState("");
  const [maxSalary, setMaxSalary] = useState("");
  const [locations, setLocations] = useState("");
  const [arrangement, setArrangement] = useState<string[]>(["Remote"]);
  const [dealbreakers, setDealbreakers] = useState("");
  const [savingGoals, setSavingGoals] = useState(false);

  // ── Drag & Drop ──────────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && (dropped.type === "application/pdf" || dropped.name.endsWith(".docx"))) {
      setFile(dropped);
    }
  }, []);

  // ── Upload CV ─────────────────────────────────────────────────────────────
  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const { uploadUrl } = await getUploadUrl(file.name, file.type);
      await uploadFileToS3(uploadUrl, file);
      setUploadDone(true);
      setTimeout(() => setStep("goals"), 1000);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // ── Save Goals ────────────────────────────────────────────────────────────
  async function handleSaveGoals(e: React.FormEvent) {
    e.preventDefault();
    setSavingGoals(true);
    try {
      await saveCareerGoals({
        targetRoles: targetRoles.split(",").map((r) => r.trim()).filter(Boolean),
        targetIndustries: selectedIndustries,
        minSalary: minSalary ? Number(minSalary) : null,
        maxSalary: maxSalary ? Number(maxSalary) : null,
        locations: locations.split(",").map((l) => l.trim()).filter(Boolean),
        workArrangement: arrangement,
        dealbreakers: dealbreakers.split(",").map((d) => d.trim()).filter(Boolean),
      });
      setStep("done");
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch {
      setSavingGoals(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl space-y-4">
        {/* Progress */}
        <div className="flex gap-2">
          {(["upload", "goals"] as Step[]).map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                step === "done" || (step === "goals" && i === 0) || step === s
                  ? "bg-primary"
                  : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* ── Step 1: Upload ── */}
        {step === "upload" && (
          <Card>
            <CardHeader>
              <CardTitle>Upload your CV</CardTitle>
              <CardDescription>PDF or DOCX — we'll extract your experience automatically</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
                  dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => document.getElementById("cv-input")?.click()}
              >
                <input
                  id="cv-input"
                  type="file"
                  accept=".pdf,.docx"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                {file ? (
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {(file.size / 1024).toFixed(0)} KB — click to change
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-4xl mb-2">📄</p>
                    <p className="font-medium">Drop your CV here</p>
                    <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-2">PDF or DOCX, max 10 MB</p>
                  </div>
                )}
              </div>

              {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
              {uploadDone && <p className="text-sm text-green-600">✓ Uploaded! Analysing your CV…</p>}

              <Button
                onClick={handleUpload}
                disabled={!file || uploading || uploadDone}
                className="w-full"
              >
                {uploading ? "Uploading…" : uploadDone ? "Done!" : "Upload CV"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Step 2: Career Goals ── */}
        {step === "goals" && (
          <Card>
            <CardHeader>
              <CardTitle>Set your career goals</CardTitle>
              <CardDescription>
                We use this to find jobs that actually align with where you want to go
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveGoals} className="space-y-5">
                <div className="space-y-1">
                  <Label>Target Job Titles</Label>
                  <Input
                    placeholder="e.g. Senior Software Engineer, Tech Lead"
                    value={targetRoles}
                    onChange={(e) => setTargetRoles(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">Separate multiple roles with commas</p>
                </div>

                <div className="space-y-2">
                  <Label>Target Industries</Label>
                  <div className="flex flex-wrap gap-2">
                    {INDUSTRIES.map((ind) => (
                      <Badge
                        key={ind}
                        variant={selectedIndustries.includes(ind) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() =>
                          setSelectedIndustries((prev) =>
                            prev.includes(ind) ? prev.filter((i) => i !== ind) : [...prev, ind]
                          )
                        }
                      >
                        {ind}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Min Salary (£/$ /year)</Label>
                    <Input
                      type="number"
                      placeholder="60000"
                      value={minSalary}
                      onChange={(e) => setMinSalary(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Max Salary</Label>
                    <Input
                      type="number"
                      placeholder="100000"
                      value={maxSalary}
                      onChange={(e) => setMaxSalary(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Preferred Locations</Label>
                  <Input
                    placeholder="e.g. London, Remote UK, New York"
                    value={locations}
                    onChange={(e) => setLocations(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Work Arrangement</Label>
                  <div className="flex gap-2">
                    {WORK_ARRANGEMENTS.map((wa) => (
                      <Badge
                        key={wa}
                        variant={arrangement.includes(wa) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() =>
                          setArrangement((prev) =>
                            prev.includes(wa) ? prev.filter((a) => a !== wa) : [...prev, wa]
                          )
                        }
                      >
                        {wa}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Dealbreakers</Label>
                  <Input
                    placeholder="e.g. no equity, required relocation, unpaid overtime"
                    value={dealbreakers}
                    onChange={(e) => setDealbreakers(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">We'll skip any jobs matching these</p>
                </div>

                <Button type="submit" className="w-full" disabled={savingGoals}>
                  {savingGoals ? "Saving…" : "Save Goals & Find Jobs →"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ── Done ── */}
        {step === "done" && (
          <Card>
            <CardContent className="pt-10 pb-10 text-center space-y-2">
              <p className="text-5xl">🎉</p>
              <p className="text-lg font-semibold">You're all set!</p>
              <p className="text-muted-foreground">Taking you to your dashboard…</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
