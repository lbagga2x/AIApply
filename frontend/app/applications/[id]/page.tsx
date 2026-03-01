import ApplicationDetailClient from "./application-detail-client";

// IDs are not known at build time — pages are rendered client-side via
// SPA routing (CloudFront 404 → index.html → Next.js router).
// generateStaticParams must live in a server component (no "use client").
export function generateStaticParams() {
  return [];
}

export default function ApplicationDetailPage() {
  return <ApplicationDetailClient />;
}
