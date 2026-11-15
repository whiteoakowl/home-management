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

  const stop = useCallback(() => {
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
    setCamera("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current!;
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
    } catch {
      stop();
      setCamera("error");
    }
  }, [formats, found, stop]);

  useEffect(() => stop, [stop]);
  return { videoRef, camera, start, stop, supported };
}
