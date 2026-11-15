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
    setCamera("starting");
    try {
      // This is what makes the phone ask "Allow camera?". Prefer the back camera; any camera will do.
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch (e) {
        if ((e as Error)?.name !== "OverconstrainedError" && (e as Error)?.name !== "NotFoundError") throw e;
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
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
      if (window.BarcodeDetector) {
        video.srcObject = stream;
        await video.play();
        setCamera("on");
        const detector = new window.BarcodeDetector({ formats });
        const tick = async () => {
          if (!streamRef.current) return;
          try {
            const hit = await detector.detect(video);
            if (hit[0]?.rawValue) return found(hit[0].rawValue);
          } catch {
            /* frame not ready */
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      } else {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat: F, DecodeHintType }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
        const map = { ean_13: F.EAN_13, ean_8: F.EAN_8, upc_a: F.UPC_A, upc_e: F.UPC_E, code_128: F.CODE_128 } as const;
        const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, formats.map((x) => map[x])]]);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
        const controls = await reader.decodeFromStream(stream, video, (result) => {
          if (result) found(result.getText());
        });
        zxingStop.current = () => controls.stop();
        if (!streamRef.current) controls.stop();
        else setCamera("on");
      }
    } catch (e) {
      if (token !== run.current) return;
      stop();
      setError(cameraHelp((e as Error)?.name));
      setCamera("error");
    }
  }, [formats, found, stop]);

  useEffect(() => stop, [stop]);
  return { videoRef, camera, start, stop, supported, error };
}

/** Plain-language help for why the camera didn't open. */
export function cameraHelp(name: string | undefined) {
  // iPads report themselves as a Mac, but with a touch screen.
  const ios = typeof navigator !== "undefined" && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));
  if (name === "NotAllowedError" || name === "SecurityError")
    return ios
      ? "Camera access is blocked for this site. In Safari, tap the aA (or ⋯) button in the address bar → Website Settings → Camera → Allow, then tap Start scanning. If you use the Home Screen app, go to the iPhone/iPad Settings app → Apps → Safari → Camera → Ask or Allow."
      : "Camera access is blocked for this site. Tap the lock or settings icon next to the web address → Permissions → Camera → Allow, then tap Start scanning. Also check the phone's Settings → Apps → your browser → Permissions → Camera.";
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
