import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page is per-family and per-user, so pages render per request.
  // See docs/ARCHITECTURE.md §1.
  cacheComponents: false,
  // Image uploads (recipes, plants, animals, journal…) go through server actions.
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
  serverExternalPackages: ["sharp"],
  async redirects() {
    // The Witchcraft section is now "Spiritual"; keep old links and bookmarks working.
    return [
      { source: "/witchcraft", destination: "/spiritual", permanent: true },
      { source: "/witchcraft/:path*", destination: "/spiritual/:path*", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        // Security headers for every page and file.
        source: "/:path*",
        headers: [
          // Nobody can show the app inside a frame on another site (clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // HTTPS only from now on (browsers ignore this on plain http, e.g. local development).
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          // Camera for barcode scanning; location for weather; nothing else.
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=(), usb=(), interest-cohort=()" },
        ],
      },
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
