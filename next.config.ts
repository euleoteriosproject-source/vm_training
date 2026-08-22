import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1", "192.168.2.109"],
  experimental: { optimizePackageImports: ["lucide-react", "recharts"] },
};

export default nextConfig;
