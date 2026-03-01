"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

// Mock data — replace with real API call using useEffect
const MOCK = {
  company: "Stripe",
  jobTitle: "Senior Software Engineer",
  location: "Remote (UK)",
  salary: "£95,000 – £130,000",
  matchScore: 94,
  alignmentScore: 91,
  status: "review",
  alignmentReason:
    "This role aligns with your goal of working at a high-growth fintech company on distributed systems. Stripe's engineering culture matches your preference for technical depth over management.",
  jobDescription:
    "We are looking for a Senior Software Engineer to join our Payments Infrastructure team. You will design and build highly reliable distributed systems that process payments at global scale...",
  companyResearch:
    "Stripe is a global fintech leader processing ~$1 trillion in payments annually. Engineering-first culture with strong emphasis on technical excellence. Remote-friendly. Known for competitive comp and equity.",
  originalCvHighlights: [
    "Built distributed systems at scale using Go and Kubernetes",
    "Led backend team of 4 engineers",
    "5 years of experience in financial services APIs",
  ],
  tailoredChanges: [
    { type: "added",    text: "Highlighted payment processing experience in summary" },
    { type: "modified", text: "Reordered skills to lead with Go, Kafka, distributed systems" },
    { type: "added",    text: "Quantified API reliability improvement: 99.99% → 99.999% uptime" },
    { type: "removed",  text: "Removed unrelated frontend work from early career" },
  ],
};

const CHANGE_COLOURS: Record<string, string> = {
  added:    "text-green-700 bg-green-50 border-green-200",
  modified: "text-yellow-700 bg-yellow-50 border-yellow-200",
  removed:  "text-red-700 bg-red-50 border-red-200",
};

export default function ApplicationDetailPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b sticky top-0 bg-background/80 backdrop-blur z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            ← Dashboard
          </Link>
          <Separator orientation="vertical" className="h-5" />
          <span className="font-semibold">{MOCK.company} — {MOCK.jobTitle}</span>
          <Badge className="ml-auto">{MOCK.status}</Badge>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: Job details */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{MOCK.jobTitle}</CardTitle>
                    <p className="text-muted-foreground font-medium">{MOCK.company}</p>
                  </div>
                  <div className="text-right text-sm space-y-1">
                    <Badge variant="secondary">{MOCK.matchScore}% match</Badge>
                    <div />
                    <Badge variant="outline">{MOCK.alignmentScore}% career fit</Badge>
                  </div>
                </div>
                <div className="flex gap-3 text-sm text-muted-foreground mt-1">
                  <span>📍 {MOCK.location}</span>
                  <span>💰 {MOCK.salary}</span>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="job">
                  <TabsList className="mb-3">
                    <TabsTrigger value="job">Job</TabsTrigger>
                    <TabsTrigger value="company">Company</TabsTrigger>
                    <TabsTrigger value="alignment">Why You</TabsTrigger>
                  </TabsList>
                  <TabsContent value="job" className="text-sm text-muted-foreground leading-relaxed">
                    {MOCK.jobDescription}
                  </TabsContent>
                  <TabsContent value="company" className="text-sm text-muted-foreground leading-relaxed">
                    {MOCK.companyResearch}
                  </TabsContent>
                  <TabsContent value="alignment" className="text-sm leading-relaxed">
                    <p className="text-muted-foreground">{MOCK.alignmentReason}</p>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-3">
              <Button className="flex-1">✓ Approve & Submit</Button>
              <Button variant="outline" className="flex-1">✏️ Edit CV</Button>
              <Button variant="ghost">Skip</Button>
            </div>
          </div>

          {/* Right: CV diff */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">CV Changes for {MOCK.company}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  What we tailored to match this role and company
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {MOCK.tailoredChanges.map((change, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 text-sm px-3 py-2 rounded border ${CHANGE_COLOURS[change.type]}`}
                  >
                    <span className="font-semibold capitalize whitespace-nowrap">{change.type}</span>
                    <span>{change.text}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Your Strongest Highlights</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {MOCK.originalCvHighlights.map((h, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="text-green-600 mt-0.5">✓</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* ATS Score */}
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center gap-6">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Original ATS</p>
                  <p className="text-2xl font-bold text-muted-foreground">61</p>
                </div>
                <div className="flex-1 h-px bg-border relative">
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">→</span>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Tailored ATS</p>
                  <p className="text-2xl font-bold text-green-600">88</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-green-600 font-medium">+27 pts</p>
                  <p className="text-xs text-muted-foreground">improvement</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
