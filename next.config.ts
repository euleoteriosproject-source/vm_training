import type { NextConfig } from "next";

const supabaseInternalUrl = (
  process.env.SUPABASE_INTERNAL_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
)?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1", "192.168.2.109"],
  experimental: { optimizePackageImports: ["lucide-react", "recharts"] },
  async rewrites() {
    return supabaseInternalUrl
      ? [
          {
            source: "/supabase/:path*",
            destination: `${supabaseInternalUrl}/:path*`,
          },
        ]
      : [];
  },
};

export default nextConfig;
