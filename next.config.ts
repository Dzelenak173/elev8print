import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return ["/approve", "/admin/:path*", "/approval-preview"].map((source) => ({
      source,
      headers: [
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    }));
  },
};

export default nextConfig;
