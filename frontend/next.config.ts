import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export", // Required for S3/CloudFront static hosting
  turbopack: {
    root: __dirname, // Prevent Turbopack from picking up lockfiles outside this project
  },
};

export default nextConfig;
