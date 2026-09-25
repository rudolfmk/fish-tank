import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  experimental: { proxyTimeout: 180_000 },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/:path*` }];
  },
};
export default nextConfig;
