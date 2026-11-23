"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { splitSpokenItems } from "@/lib/voice-list";
import { cn } from "@/lib/utils";

type Result = { isFinal: boolean; 0: { transcript: string } };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<Result> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
type RecognitionCtor = new () => Recognition;

const recognitionCtor = (): RecognitionCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/**
 * Speak to add items: "milk, eggs and two pounds of apples" fills the add box
 * with one item per line, ready to check and add. Uses the browser's own
 * speech recognition (where available); nothing is recorded or stored.
 */
export function VoiceAddButton({ onItems, split = true }: { onItems: (items: string[]) => number; split?: boolean }) {
  const rec = useRef<Recognition | null>(null);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSupported(!!recognitionCtor()), 0);
    return () => {
      clearTimeout(t);
      rec.current?.abort();
    };
  }, []);

  if (!supported) return null;

  const addToBox = (text: string) => onItems(splitSpokenItems(text, { split }));

  const start = () => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = navigator.language || "en-US";
    r.interimResults = true;
    r.continuous = true;
    let added = 0;
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        if (res.isFinal) added += addToBox(res[0].transcript);
        else interim += res[0].transcript;
      }
      setHeard(interim);
    };
    r.onerror = (e) => {
      setStatus(e.error === "not-allowed" || e.error === "service-not-allowed" ? "Allow the microphone for this site to speak items." : e.error === "no-speech" ? "Didn't catch that. Try again." : "Speech didn't work this time. Try again.");
    };
    r.onend = () => {
      setListening(false);
      setHeard("");
      if (added) {
        setStatus(`${added} item${added === 1 ? "" : "s"} ready. Check them, then tap Add.`);
      }
    };
    rec.current = r;
    setStatus(null);
    setHeard("");
    try {
      r.start();
      setListening(true);
    } catch {
      setStatus("Speech didn't start. Try again.");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => (listening ? rec.current?.stop() : start())}
        aria-pressed={listening}
        aria-label={listening ? "Stop listening" : "Speak items to add"}
        title={listening ? "Stop listening" : "Speak items to add"}
        className={cn(
          "inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] border focus-visible:ring-4 focus-visible:ring-primary-200 focus-visible:outline-none",
          listening ? "animate-pulse border-wine-300 bg-wine-50 text-wine-600 motion-reduce:animate-none" : "border-line-strong bg-surface text-ink-soft hover:bg-sunken",
        )}
      >
        {listening ? <Square className="size-4" /> : <Mic className="size-5" />}
      </button>
      {(listening || status) && (
        <p role="status" aria-live="polite" className="order-last basis-full text-sm text-muted">
          {listening ? (heard ? `Hearing: “${heard}”` : "Listening… say your items, like “milk, eggs and two pounds of apples”.") : status}
        </p>
      )}
    </>
  );
}
