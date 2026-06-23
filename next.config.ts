import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The rules engine reads YAML files and samples from disk at runtime;
  // keep them traced into the serverless bundle.
  outputFileTracingIncludes: {
    "/api/**": ["./src/rules/**/*", "./samples/**/*"],
  },
};

export default nextConfig;
