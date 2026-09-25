import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL;

const nextConfig: NextConfig = {
  experimental: { proxyTimeout: 180_000 },
  async rewrites() {
    // Without BACKEND_URL on Vercel, /api is served by the Python function.
    if (!backendUrl) {
      return process.env.VERCEL
        ? []
        : [{ source: "/api/:path*", destination: "http://localhost:8000/:path*" }];
    }
    return [{ source: "/api/:path*", destination: `${backendUrl}/:path*` }];
  },
};
export default nextConfig;
