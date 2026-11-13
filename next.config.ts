import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page is per-family and per-user, so pages render per request.
  // See docs/ARCHITECTURE.md §1.
  cacheComponents: false,
  // Image uploads (recipes, plants, animals, journal…) go through server actions.
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
  serverExternalPackages: ["sharp"],
  async headers() {
    return [
      {
        // The service worker must always be re-checked so app updates reach installed phones.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
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
