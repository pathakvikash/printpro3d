import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["three"],
  // safety net for slow build machines (default 60 s per page); prerender no longer runs CSG, see routeBundles.test.ts
  staticPageGenerationTimeout: 180,
  // /api/orders reads the kit STL files from public/ to price them: make sure they are in the function bundle
  outputFileTracingIncludes: { "/api/orders": ["./public/models/kits/**/*"] },
  // Build lives inside the Playground (/playground?mode=build). Next merges the request's query string (example, sim, step, prompt, from) into these destinations.
  async redirects() {
    return [
      { source: "/build", destination: "/playground?mode=build", permanent: false },
      { source: "/draw", destination: "/playground?mode=build", permanent: false },
      // /ai is the "Build with AI" chat page (header and floating AI buttons open the same chat as a panel)
    ];
  },
};

export default nextConfig;
