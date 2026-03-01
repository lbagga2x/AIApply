import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export", // Required for S3/CloudFront static hosting
};

export default nextConfig;
