"use client";

import { useEffect } from "react";
import "./install-store";

/** Registers /sw.js (production only, so development always sees fresh code). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      /* Installing still works without it; ignore. */
    });
  }, []);
  return null;
}
