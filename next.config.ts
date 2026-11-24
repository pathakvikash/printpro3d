import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["three"],
  // /api/orders reads the kit STL files from public/ to price them: make sure they are in the function bundle
  outputFileTracingIncludes: { "/api/orders": ["./public/models/kits/**/*"] },
  // Build lives inside the Playground (/playground?mode=build). Next merges the request's query string (example, sim, step, prompt, from) into these destinations.
  async redirects() {
    return [
      { source: "/build", destination: "/playground?mode=build", permanent: false },
      { source: "/draw", destination: "/playground?mode=build", permanent: false },
      { source: "/ai", destination: "/playground?mode=build", permanent: false },
    ];
  },
};

export default nextConfig;
