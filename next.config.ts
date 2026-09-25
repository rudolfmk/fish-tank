import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  experimental: { proxyTimeout: 180_000 },
  async rewrites() {
    // On Vercel the FastAPI backend is served by the Python function in /api.
    if (process.env.VERCEL) return [];
    return [{ source: "/api/:path*", destination: `${backendUrl}/:path*` }];
  },
};
export default nextConfig;
