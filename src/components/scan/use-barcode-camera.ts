"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => Detector;
  }
}

const noop = () => () => {};

export type BarcodeFormat = "ean_13" | "ean_8" | "upc_a" | "upc_e" | "code_128";

/**
 * Camera barcode scanning shared by the kitchen and the book library.
 * Uses the browser's BarcodeDetector where available (Chrome, Edge, Android)
 * and falls back to ZXing (loaded on demand) everywhere else, e.g. iPhone Safari.
 */
export function useBarcodeCamera({ formats, onDetect }: { formats: BarcodeFormat[]; onDetect: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zxingStop = useRef<(() => void) | null>(null);
  const onDetectRef = useRef(onDetect);
  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);
  // Server render says "no camera"; the browser corrects it after hydration (no mismatch).
  const supported = useSyncExternalStore(
    noop,
    () => !!navigator.mediaDevices?.getUserMedia,
    () => false,
  );
  const [camera, setCamera] = useState<"off" | "starting" | "on" | "error">("off");
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  // Bumped on every stop, so a camera that finishes opening after we stopped is closed again.
  const run = useRef(0);

  const stop = useCallback(() => {
    run.current++;
    zxingStop.current?.();
    zxingStop.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamera("off");
  }, []);

  const found = useCallback(
    (code: string) => {
      navigator.vibrate?.(60);
      stop();
      onDetectRef.current(code);
    },
    [stop],
  );

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(cameraHelp("unsupported"));
      setCamera("error");
      return;
    }
    const token = ++run.current;
    setError(null);
    setWaiting(false);
    setCamera("starting");
    // If the permission prompt is still open after a moment, say so (instead of a silent "Starting…").
    const permTimer = setTimeout(() => token === run.current && setWaiting(true), 2500);
    try {
      // This is what makes the phone ask "Allow camera?". Prefer the back camera; any camera will do.
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch (e) {
        if ((e as Error)?.name !== "OverconstrainedError" && (e as Error)?.name !== "NotFoundError") throw e;
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      clearTimeout(permTimer);
      setWaiting(false);
      if (token !== run.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current!;
      // iPhone/iPad only show a live camera inline when these are real attributes.
      video.setAttribute("playsinline", "");
      video.setAttribute("muted", "");
      video.muted = true;
      video.srcObject = stream;
      await startVideo(video);
      if (token !== run.current) return;
      setCamera("on");

      const detector = await nativeDetector(formats);
      if (detector) {
        const tick = async () => {
          if (!streamRef.current || token !== run.current) return;
          try {
            const hit = await detector.detect(video);
            if (hit[0]?.rawValue) return found(hit[0].rawValue);
          } catch {
            /* frame not ready */
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        return;
      }
      // Everywhere else (e.g. iPhone/iPad): read frames ourselves and decode them with ZXing.
      const [{ BrowserMultiFormatReader }, { BarcodeFormat: F, DecodeHintType }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
      const map = { ean_13: F.EAN_13, ean_8: F.EAN_8, upc_a: F.UPC_A, upc_e: F.UPC_E, code_128: F.CODE_128 } as const;
      const hints = new Map<unknown, unknown>([[DecodeHintType.POSSIBLE_FORMATS, formats.map((x) => map[x])], [DecodeHintType.TRY_HARDER, true]]);
      const reader = new BrowserMultiFormatReader(hints as never);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true } as CanvasRenderingContext2DSettings);
      const timer = window.setInterval(() => {
        if (!streamRef.current || !ctx || !video.videoWidth) return;
        const scale = Math.min(1, 1280 / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          const result = reader.decodeFromCanvas(canvas);
          if (result) found(result.getText());
        } catch {
          /* no barcode in this frame */
        }
      }, 200);
      zxingStop.current = () => window.clearInterval(timer);
      if (token !== run.current) zxingStop.current();
    } catch (e) {
      clearTimeout(permTimer);
      if (token !== run.current) return;
      stop();
      setError(cameraHelp((e as Error)?.name));
      setCamera("error");
    }
  }, [formats, found, stop]);

  useEffect(() => stop, [stop]);
  return { videoRef, camera, start, stop, supported, error, waiting };
}

/** Plain-language help for why the camera didn't open. */
export function cameraHelp(name: string | undefined) {
  // iPads report themselves as a Mac, but with a touch screen.
  const ios = typeof navigator !== "undefined" && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));
  if (name === "NotAllowedError" || name === "SecurityError")
    return ios
      ? "Camera access is blocked for this site. In Safari, tap the aA (or ⋯) button in the address bar → Website Settings → Camera → Allow, then tap Start scanning. If you use the Home Screen app, go to the iPhone/iPad Settings app → Apps → Safari → Camera → Ask or Allow."
      : "Camera access is blocked for this site. Tap the lock or settings icon next to the web address → Permissions → Camera → Allow, then tap Start scanning. Also check the phone's Settings → Apps → your browser → Permissions → Camera.";
  if (name === "VideoStartError") return "The camera opened but the picture didn't start. Tap Start scanning to try again, or type the number below.";
  if (name === "NotReadableError" || name === "AbortError") return "The camera is busy in another app. Close other apps using the camera, then tap Start scanning.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera was found on this device. Type the number below instead.";
  if (name === "unsupported")
    return typeof window !== "undefined" && !window.isSecureContext
      ? "The camera only works when the site is opened with https://. Open the secure address and try again."
      : "This browser can't open the camera. Try Safari on iPhone/iPad or Chrome on Android, or type the number below.";
  return "We couldn't open the camera. Tap Start scanning to try again, or type the number below.";
}

/** Ask for the camera as soon as a scanner page opens (the browser shows its permission prompt). */
export function useAutoStart(start: () => void, supported: boolean) {
  const done = useRef(false);
  useEffect(() => {
    if (!supported || done.current) return;
    done.current = true;
    start();
  }, [supported, start]);
}

/**
 * Start a camera <video> and resolve once frames are flowing. Never hangs: if play() is
 * refused or interrupted we wait for the video's own events, and give up after 8 seconds.
 */
function startVideo(video: HTMLVideoElement) {
  return new Promise<void>((resolve, reject) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      video.removeEventListener("playing", onReady);
      video.removeEventListener("loadeddata", onReady);
      if (ok) resolve();
      else reject(Object.assign(new Error("The camera picture didn't start."), { name: "VideoStartError" }));
    };
    const onReady = () => {
      if (video.paused) video.play().catch(() => {});
      if (video.readyState >= 2) finish(true);
    };
    const timer = window.setTimeout(() => finish(video.readyState >= 2), 8000);
    video.addEventListener("playing", onReady);
    video.addEventListener("loadeddata", onReady);
    video.play().then(() => finish(true), () => {
      /* interrupted or refused: the events above (or the timeout) decide */
    });
    if (video.readyState >= 2 && !video.paused) finish(true);
  });
}

/** The browser's own barcode reader when it supports our formats (Chrome/Edge on Android), else null. */
async function nativeDetector(formats: BarcodeFormat[]): Promise<Detector | null> {
  const BD = window.BarcodeDetector as (typeof window.BarcodeDetector & { getSupportedFormats?: () => Promise<string[]> }) | undefined;
  if (!BD) return null;
  try {
    const supported = BD.getSupportedFormats ? await BD.getSupportedFormats() : formats;
    const usable = formats.filter((f) => supported.includes(f));
    return usable.length ? new BD({ formats: usable }) : null;
  } catch {
    return null;
  }
}
