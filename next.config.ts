import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page is per-family and per-user, so pages render per request.
  // See docs/ARCHITECTURE.md §1.
  cacheComponents: false,
  // Image uploads (recipes, plants, animals, journal…) go through server actions.
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
  serverExternalPackages: ["sharp"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
