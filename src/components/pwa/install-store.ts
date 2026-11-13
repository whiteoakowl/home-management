"use client";

/**
 * Tracks whether the app can be installed. Chrome/Edge/Android fire
 * `beforeinstallprompt`, which we keep to trigger later from our own button;
 * iPhone Safari has no such event, so we show "Add to Home Screen" steps.
 * Loaded from the root layout so the event is never missed.
 */
type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: PromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const DISMISS_KEY = "vf-install-dismissed";

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as PromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    emit();
  });
}

export type InstallState = "server" | "installed" | "prompt" | "ios" | "unsupported";

const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export function getInstallState(): InstallState {
  if (installed || isStandalone()) return "installed";
  if (deferred) return "prompt";
  if (isIos()) return "ios";
  return "unsupported";
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export async function promptInstall() {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  await e.prompt();
  const { outcome } = await e.userChoice;
  if (outcome === "accepted") installed = true;
  emit();
  return outcome === "accepted";
}

export function bannerDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissBanner() {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* storage unavailable: the banner just reappears next visit */
  }
  emit();
}
