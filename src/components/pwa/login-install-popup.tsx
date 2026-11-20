"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, EllipsisVertical, Share, Smartphone, SquarePlus } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { Modal } from "@/components/ui/modal";
import { getInstallState, promptInstall, subscribe, type InstallState } from "./install-store";

/**
 * Sign-in page pop-up: "Get the app". Uses the browser's own install prompt
 * (Android, Chrome, Edge), Add to Home Screen steps on iPhone, or the menu
 * steps elsewhere on Android; on a computer it explains how to get it on a
 * phone. Shown once every two weeks until installed; the "Get the app"
 * link under the form opens it anytime.
 */
const SEEN_KEY = "fb-login-install-seen";
const AGAIN_AFTER = 14 * 86_400_000;

const noop = () => () => {};
const isAndroid = () => /android/i.test(navigator.userAgent);
const useInstallState = () => useSyncExternalStore<InstallState>(subscribe, getInstallState, () => "server");

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-50 font-semibold text-primary-700">{n}</span>
      <span className="pt-1">{children}</span>
    </li>
  );
}

export function LoginInstallPopup({ appName, knowsFamily = false }: { appName: string; knowsFamily?: boolean }) {
  const state = useInstallState();
  const [open, setOpen] = useState(false);
  // Browser-only facts, read without an effect (server render: false / "").
  const android = useSyncExternalStore(noop, isAndroid, () => false);
  const origin = useSyncExternalStore(noop, () => window.location.host, () => "");

  // Open by itself a moment after the page loads, unless already installed or recently seen.
  useEffect(() => {
    if (state === "server" || state === "installed") return;
    let seen = 0;
    try {
      seen = Number(localStorage.getItem(SEEN_KEY) ?? 0);
    } catch {
      /* private mode: show it */
    }
    if (Date.now() - seen < AGAIN_AFTER) return;
    const t = window.setTimeout(() => setOpen(true), 900);
    return () => window.clearTimeout(t);
  }, [state]);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  if (state === "server" || state === "installed") return null;
  const phone = state === "ios" || android;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="mx-auto mt-4 flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:underline">
        <Smartphone className="size-4" aria-hidden /> Get the app
      </button>
      <Modal open={open} onClose={close} title={`Get the ${appName} app`} size="sm">
        <div className="flex flex-col gap-4 text-[15px]">
          <div className="flex items-center gap-3">
            <BrandMark className="size-14 shrink-0" />
            <p className="text-ink-soft">Free to download. It opens full-screen from your home screen, like any other app, and shows your family&apos;s name.</p>
          </div>

          {state === "prompt" ? (
            <button
              type="button"
              onClick={async () => {
                await promptInstall();
                close();
              }}
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary-600 font-semibold text-white hover:bg-primary-700"
            >
              <Download className="size-5" aria-hidden /> Download the app
            </button>
          ) : state === "ios" ? (
            <ol className="flex flex-col gap-3">
              <Step n={1}>
                Tap the <strong>Share</strong> button <Share className="inline size-4 align-text-bottom" aria-label="Share icon" /> in Safari.
              </Step>
              <Step n={2}>
                Tap <strong>Add to Home Screen</strong> <SquarePlus className="inline size-4 align-text-bottom" aria-label="Add icon" />.
              </Step>
              <Step n={3}>
                Tap <strong>Add</strong>. The app appears on your Home Screen.
              </Step>
              <p className="text-sm text-muted">Using Chrome or another browser on iPhone? Open this page in Safari first.</p>
            </ol>
          ) : android ? (
            <ol className="flex flex-col gap-3">
              <Step n={1}>
                Tap your browser&apos;s menu <EllipsisVertical className="inline size-4 align-text-bottom" aria-label="menu icon" />.
              </Step>
              <Step n={2}>
                Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
              </Step>
              <Step n={3}>Confirm, and the app appears with your other apps.</Step>
            </ol>
          ) : (
            <ol className="flex flex-col gap-3">
              <Step n={1}>
                On your phone, open <strong className="break-all">{origin}</strong>.
              </Step>
              <Step n={2}>Sign in, then add it to your home screen when asked.</Step>
            </ol>
          )}

          {phone && !knowsFamily && <p className="text-sm text-muted">Tip: sign in first, then install, so the app is named after your family.</p>}
          <button type="button" onClick={close} className="h-11 rounded-full text-sm font-medium text-muted hover:bg-sunken">
            {state === "prompt" || phone ? "Not now" : "Close"}
          </button>
        </div>
      </Modal>
    </>
  );
}
