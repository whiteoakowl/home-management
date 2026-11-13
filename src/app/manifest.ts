import type { MetadataRoute } from "next";

/** Makes the app installable ("Add to Home Screen" / "Install app"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Vanderbilt Family",
    short_name: "Vanderbilt",
    description: "Your family's home, organised in one place.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f6f3ef",
    theme_color: "#2d0f26",
    categories: ["lifestyle", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Calendar", url: "/calendar", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Chores", url: "/house/chores", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Shopping list", url: "/shopping", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Meal plan", url: "/meals", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
