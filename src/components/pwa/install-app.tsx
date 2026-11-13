"use client";

import { useState, useSyncExternalStore } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { bannerDismissed, dismissBanner, getInstallState, promptInstall, subscribe, type InstallState } from "./install-store";

const useInstallState = () => useSyncExternalStore<InstallState>(subscribe, getInstallState, () => "server");
const useDismissed = () => useSyncExternalStore(subscribe, bannerDismissed, () => true);

function IosSteps({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Add to your Home Screen" size="sm">
      <ol className="flex flex-col gap-4 text-[15px]">
        <li className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-50 font-semibold text-primary-700">1</span>
          <span>
            In Safari, tap the <strong>Share</strong> button <Share className="inline size-4 align-text-bottom" aria-label="Share icon" /> at the bottom of the screen.
          </span>
        </li>
        <li className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-50 font-semibold text-primary-700">2</span>
          <span>
            Scroll down and tap <strong>Add to Home Screen</strong> <SquarePlus className="inline size-4 align-text-bottom" aria-label="Add icon" />.
          </span>
        </li>
        <li className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-50 font-semibold text-primary-700">3</span>
          <span>
            Tap <strong>Add</strong>. Vanderbilt Family appears on your Home Screen and opens full-screen, like an app.
          </span>
        </li>
      </ol>
      <p className="mt-4 text-sm text-muted">Using Chrome on iPhone? Open this page in Safari first; only Safari can add apps to the Home Screen.</p>
    </Modal>
  );
}

/** "Install app" button: native prompt where supported, iPhone steps otherwise; hidden once installed. */
export function InstallAppButton({ className, label = "Install app" }: { className?: string; label?: string }) {
  const state = useInstallState();
  const [ios, setIos] = useState(false);
  if (state !== "prompt" && state !== "ios") return null;
  return (
    <>
      <button type="button" onClick={() => (state === "ios" ? setIos(true) : void promptInstall())} className={className}>
        <Download className="size-5 shrink-0" aria-hidden />
        <span>{label}</span>
      </button>
      <IosSteps open={ios} onClose={() => setIos(false)} />
    </>
  );
}

/** One-time dashboard banner inviting phones to install the app. */
export function InstallBanner() {
  const state = useInstallState();
  const dismissed = useDismissed();
  const [ios, setIos] = useState(false);
  if (dismissed || (state !== "prompt" && state !== "ios")) return null;
  return (
    <section aria-label="Install the app" className="flex items-center gap-3 rounded-2xl border border-primary-100 bg-primary-50 p-3 pr-2 sm:p-4">
      <BrandMark className="size-11 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">Get the Vanderbilt Family app</p>
        <p className="text-sm text-ink-soft">Add it to your home screen for one-tap access, full-screen.</p>
      </div>
      <button
        type="button"
        onClick={() => (state === "ios" ? setIos(true) : void promptInstall())}
        className={cn("h-10 shrink-0 rounded-full bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700")}
      >
        {state === "ios" ? "How to" : "Install"}
      </button>
      <button type="button" onClick={dismissBanner} aria-label="Dismiss" className="size-9 shrink-0 rounded-full text-muted hover:bg-surface">
        <X className="mx-auto size-4" />
      </button>
      <IosSteps open={ios} onClose={() => setIos(false)} />
    </section>
  );
}
