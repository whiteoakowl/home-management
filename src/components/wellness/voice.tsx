"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2 } from "lucide-react";

/**
 * Record a voice note in the browser and attach it to the form as `name`.
 * Falls back to picking a recording from the phone when recording isn't
 * available.
 */
export function VoiceRecorder({ name = "voice" }: { name?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [state, setState] = useState<"idle" | "recording" | "done">("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [secs, setSecs] = useState(0);
  const [canRecord, setCanRecord] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ok = typeof window !== "undefined" && "MediaRecorder" in window && !!navigator.mediaDevices?.getUserMedia && typeof DataTransfer !== "undefined";
    const t = setTimeout(() => setCanRecord(ok), 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (state !== "recording") return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [state]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported?.(t));
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const mime = (r.mimeType || type || "audio/webm").split(";")[0]!;
        const blob = new Blob(chunks.current, { type: mime });
        const file = new File([blob], `voice-note.${mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm"}`, { type: mime });
        const dt = new DataTransfer();
        dt.items.add(file);
        if (input.current) input.current.files = dt.files;
        setUrl(URL.createObjectURL(blob));
        setState("done");
      };
      rec.current = r;
      r.start();
      setSecs(0);
      setState("recording");
    } catch {
      setError("Couldn't use the microphone. Check your browser's permission, or pick a recording instead.");
      setCanRecord(false);
    }
  };
  const stop = () => {
    if (rec.current?.state === "recording") rec.current.stop();
    if (secs >= 600) setError("Voice notes can be up to 10 minutes.");
  };
  const clear = () => {
    if (input.current) input.current.value = "";
    setUrl(null);
    setState("idle");
  };
  useEffect(() => {
    if (state === "recording" && secs >= 600) rec.current?.stop();
  }, [secs, state]);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-ink-soft">Voice note (optional)</legend>
      <input ref={input} type="file" name={name} accept="audio/*" capture className={canRecord ? "sr-only" : "text-sm"} tabIndex={canRecord ? -1 : 0} aria-label="Choose a voice recording" />
      {canRecord && (
        <div className="flex flex-wrap items-center gap-2">
          {state === "recording" ? (
            <button type="button" onClick={stop} className="inline-flex h-11 items-center gap-2 rounded-full bg-wine-500 px-4 text-sm font-semibold text-white">
              <Square className="size-4" aria-hidden /> Stop ({Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")})
            </button>
          ) : (
            <button type="button" onClick={() => void start()} className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong px-4 text-sm font-medium hover:bg-sunken">
              <Mic className="size-4" aria-hidden /> {state === "done" ? "Record again" : "Record"}
            </button>
          )}
          {url && (
            <>
              <audio controls src={url} className="h-10 max-w-full" />
              <button type="button" onClick={clear} aria-label="Remove voice note" className="inline-flex size-10 items-center justify-center rounded-full text-muted hover:bg-sunken">
                <Trash2 className="size-4" />
              </button>
            </>
          )}
        </div>
      )}
      {error && <p className="text-xs text-wine-600">{error}</p>}
      <p className="text-xs text-muted">Private like the rest of your entry.</p>
    </fieldset>
  );
}

type Recognition = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> & { length: number }; resultIndex: number }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };

/** Speak instead of typing: adds what you say to the box named `target` (where the browser supports it). */
export function DictateButton({ target }: { target: string }) {
  const btn = useRef<HTMLButtonElement>(null);
  const r = useRef<Recognition | null>(null);
  const [on, setOn] = useState(false);
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const t = setTimeout(() => setSupported(!!(w.SpeechRecognition ?? w.webkitSpeechRecognition)), 0);
    return () => clearTimeout(t);
  }, []);
  if (!supported) return null;
  const toggle = () => {
    if (on) {
      r.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const SR = (w.SpeechRecognition ?? w.webkitSpeechRecognition)!;
    const rec = new SR();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = false;
    rec.continuous = true;
    rec.onresult = (e) => {
      const box = btn.current?.closest("form")?.querySelector<HTMLTextAreaElement>(`[name="${target}"]`);
      if (!box) return;
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i]![0]!.transcript;
      box.value = `${box.value}${box.value && !box.value.endsWith(" ") ? " " : ""}${text.trim()}`;
    };
    rec.onend = () => setOn(false);
    rec.onerror = () => setOn(false);
    r.current = rec;
    rec.start();
    setOn(true);
  };
  return (
    <button ref={btn} type="button" onClick={toggle} aria-pressed={on} className="inline-flex h-10 w-fit items-center gap-2 rounded-full border border-line-strong px-3 text-sm font-medium hover:bg-sunken">
      <Mic className="size-4" aria-hidden /> {on ? "Listening… tap to stop" : "Speak instead of typing"}
    </button>
  );
}
