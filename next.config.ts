import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker builds need standalone output. On Windows without symlink privileges
  // the standalone copy step fails with EPERM, so make it opt-in via env.
  ...(process.env.NEXT_OUTPUT_STANDALONE === "true"
    ? { output: "standalone" as const }
    : {}),
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
