import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page is per-family and per-user, so pages render per request.
  // See docs/ARCHITECTURE.md §1.
  cacheComponents: false,
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
