import { Suspense } from "react";
import ApplicationDetailClient from "./application-detail-client";

/**
 * Static page at /applications that reads the application ID from the ?id=
 * query parameter. This avoids the dynamic [id] route segment, which causes
 * Next.js static export to fail for unknown IDs (RSC payload not found →
 * CloudFront 404 → index.html loop).
 *
 * Suspense is required because useSearchParams() is called inside a client
 * component in a static export — Next.js mandates it to avoid hydration mismatches.
 */
export default function ApplicationsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Loading application…</p>
        </div>
      }
    >
      <ApplicationDetailClient />
    </Suspense>
  );
}
