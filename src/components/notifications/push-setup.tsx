"use client";

import { useEffect, useState, useTransition } from "react";
import { BellOff, BellRing, Send } from "lucide-react";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

const toKey = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
const deviceName = () => {
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Device";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return `${os}${br ? ` · ${br}` : ""}`;
};

/** Turn push notifications on or off for this phone/computer, and send a test. */
export function PushSetup({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<State>("loading");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const check = async () => {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState(ios && !standalone ? "ios-install" : "unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    };
    check().catch(() => setState("unsupported"));
  }, []);

  if (!publicKey) return <p className="text-sm text-muted">Push notifications aren&apos;t set up for this app yet. (The site owner adds the push keys; see the launch guide.)</p>;

  const turnOn = () =>
    start(async () => {
      setMsg(null);
      try {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          setState(perm === "denied" ? "denied" : "off");
          return;
        }
        const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
        await navigator.serviceWorker.ready;
        const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) }));
        const res = await savePushSubscription(sub.toJSON(), deviceName());
        if (!res.ok) {
          setMsg(res.message ?? "That didn't work. Please try again.");
          return;
        }
        setState("on");
        setMsg("Push is on for this device.");
      } catch {
        setMsg("This device couldn't turn on push. Please try again.");
      }
    });

  const turnOff = () =>
    start(async () => {
      setMsg(null);
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe().catch(() => {});
      }
      setState("off");
      setMsg("Push is off for this device.");
    });

  const test = () =>
    start(async () => {
      const r = await sendTestPush();
      setMsg(r.message);
    });

  return (
    <div className="flex flex-col gap-3">
      {state === "loading" && <p className="text-sm text-muted">Checking this device…</p>}
      {state === "unsupported" && <p className="text-sm text-muted">This browser can&apos;t receive push notifications. Try Chrome, Edge, Firefox or Safari, or the app on your phone&apos;s home screen.</p>}
      {state === "ios-install" && (
        <p className="text-sm">
          On iPhone and iPad, push works from the app on your Home Screen: tap the <span className="font-semibold">Share</span> button in Safari, choose <span className="font-semibold">Add to Home Screen</span>, open the app from there and come back to this page.
        </p>
      )}
      {state === "denied" && <p className="text-sm">Notifications are blocked for this site. Allow them in your browser or phone settings (Notifications → this app), then reload this page.</p>}
      {(state === "off" || state === "on") && (
        <>
          <p className="text-sm text-muted">
            {state === "on" ? "This device gets push notifications for the reminders and chats you choose below." : "Get reminders and new chat messages on this phone or computer, even when the app is closed."}
          </p>
          <div className="flex flex-wrap gap-2">
            {state === "off" ? (
              <Button onClick={turnOn} disabled={pending} icon={<BellRing className="size-4" />}>
                {pending ? "Turning on…" : "Turn on for this device"}
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={test} disabled={pending} icon={<Send className="size-4" />}>
                  Send a test
                </Button>
                <Button variant="ghost" onClick={turnOff} disabled={pending} icon={<BellOff className="size-4" />}>
                  Turn off
                </Button>
              </>
            )}
          </div>
        </>
      )}
      {msg && (
        <p role="status" className="text-sm font-medium text-primary-700">
          {msg}
        </p>
      )}
      <p className="text-xs text-muted">Quiet hours: from 9pm to 7am phones stay silent. Daily reminders come after 7am, and chat messages sent overnight are waiting in the app. The Send a test button always works right away.</p>
    </div>
  );
}
