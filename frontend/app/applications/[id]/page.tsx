import ApplicationDetailClient from "./application-detail-client";

// Real IDs are not known at build time. A placeholder is returned so
// Next.js accepts the static export. All real /applications/[id] URLs
// are served via CloudFront 404 → index.html → client-side router.
export function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function ApplicationDetailPage() {
  return <ApplicationDetailClient />;
}
