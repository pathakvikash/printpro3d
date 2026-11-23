import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["three"],
  // the blueprint-first flow lives at /build; Next keeps the query string on redirects. Old pages stay in the tree until the UI lands.
  async redirects() {
    return [
      { source: "/draw", destination: "/build", permanent: false },
      { source: "/ai", destination: "/build", permanent: false },
    ];
  },
};

export default nextConfig;
