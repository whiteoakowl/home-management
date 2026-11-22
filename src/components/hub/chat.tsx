"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, CalendarPlus, ChevronDown, ImageIcon, Megaphone, MoreHorizontal, Paperclip, Pin, Plus, SendHorizontal, Smile, SmilePlus, Trash2, X } from "lucide-react";
import { deleteMessage, sendMessage, sendPoll, shareEvent, togglePin, toggleReaction, votePoll } from "@/app/actions/hub";
import { ActionForm, FormModal } from "@/components/forms/action-form";
import { SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { ActionButton } from "@/components/forms/inline";
import { Avatar } from "@/components/ui/display";
import { SubmitButton } from "@/components/ui/form";
import { EMOJI, REACTIONS, type Channel } from "@/lib/hub-shared";
import { cn } from "@/lib/utils";

/** Opens the composer's Poll / Event windows from elsewhere on the page (the header's + button). */
const OPEN = "chat:open";
export const openComposer = (what: "poll" | "event") => window.dispatchEvent(new CustomEvent(OPEN, { detail: what }));

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return { open, setOpen, ref };
}

const chip = "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-sm font-medium text-ink-soft hover:bg-sunken";

// ─── Header ──────────────────────────────────────────────────────────────────

export function MembersButton({ count, members }: { count: number; members: { id: string; name: string; color: string; photo: string | null; holder: boolean }[] }) {
  const { open, setOpen, ref } = usePopover();
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        {count} {count === 1 ? "member" : "members"} <ChevronDown className="size-4" />
      </button>
      {open && (
        <ul className="absolute top-7 left-0 z-30 w-56 rounded-2xl border border-line bg-surface p-2 shadow-[var(--shadow-pop)]">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm">
              <Avatar name={m.name} color={m.color} photoUrl={m.photo} size="xs" /> {m.name}
              {m.holder && <span title="Account holder">👑</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function NewMenu({ canPost }: { canPost: boolean }) {
  const { open, setOpen, ref } = usePopover();
  if (!canPost) return null;
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label="New poll or event" onClick={() => setOpen((o) => !o)} className="flex size-11 items-center justify-center rounded-full bg-primary-600 text-white shadow-sm hover:bg-primary-700">
        <Plus className="size-5" />
      </button>
      {open && (
        <div className="absolute top-12 right-0 z-30 flex w-48 flex-col rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-pop)]">
          <button type="button" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[15px] hover:bg-sunken" onClick={() => (setOpen(false), openComposer("poll"))}>
            <BarChart3 className="size-4 text-olive-600" /> New poll
          </button>
          <button type="button" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[15px] hover:bg-sunken" onClick={() => (setOpen(false), openComposer("event"))}>
            <CalendarPlus className="size-4 text-wine-600" /> Share an event
          </button>
        </div>
      )}
    </div>
  );
}

/** Keeps the chat fresh (every few seconds while visible) and scrolled to the newest message. */
export function ChatLive({ latest }: { latest: string }) {
  const router = useRouter();
  useEffect(() => {
    const h = window.setInterval(() => document.visibilityState === "visible" && router.refresh(), 8000);
    return () => window.clearInterval(h);
  }, [router]);
  useEffect(() => {
    document.getElementById("chat-end")?.scrollIntoView({ block: "end" });
  }, [latest]);
  return null;
}

// ─── Messages ────────────────────────────────────────────────────────────────

export function Reactions({ id, items }: { id: string; items: { emoji: string; count: number; mine: boolean; who: string }[] }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((r) => (
        <ActionButton
          key={r.emoji}
          action={toggleReaction}
          fields={{ id, emoji: r.emoji }}
          title={r.who}
          className={cn("h-7 rounded-full border px-2 text-sm tabular-nums", r.mine ? "border-primary-300 bg-primary-50 text-primary-800" : "border-line bg-surface text-ink-soft")}
        >
          {r.emoji} {r.count}
        </ActionButton>
      ))}
    </div>
  );
}

/** React, pin or delete one message. */
export function MessageTools({ id, canPin, pinned, canDelete, mine }: { id: string; canPin: boolean; pinned: boolean; canDelete: boolean; mine: boolean }) {
  const { open, setOpen, ref } = usePopover();
  return (
    <div ref={ref} className={cn("relative self-center opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100", open && "sm:opacity-100")}>
      <button type="button" aria-label="React or more" onClick={() => setOpen((o) => !o)} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-sunken">
        <SmilePlus className="size-4" />
      </button>
      {open && (
        <div className={cn("absolute bottom-9 z-30 flex items-center gap-0.5 rounded-full border border-line bg-surface p-1 shadow-[var(--shadow-pop)]", mine ? "right-0" : "left-0")}>
          {REACTIONS.map((e) => (
            <ActionButton key={e} action={toggleReaction} fields={{ id, emoji: e }} label={`React ${e}`} className="size-9 rounded-full text-lg hover:bg-sunken">
              {e}
            </ActionButton>
          ))}
          {canPin && (
            <ActionButton action={togglePin} fields={{ id }} label={pinned ? "Unpin" : "Pin"} className="size-9 rounded-full text-muted hover:bg-sunken">
              <Pin className={cn("size-4", pinned && "fill-current text-primary-600")} />
            </ActionButton>
          )}
          {canDelete && (
            <ActionButton action={deleteMessage} fields={{ id }} confirm="Delete this message?" label="Delete" className="size-9 rounded-full text-muted hover:bg-wine-50 hover:text-wine-600">
              <Trash2 className="size-4" />
            </ActionButton>
          )}
        </div>
      )}
    </div>
  );
}

export function PollCard({ id, question, options, total }: { id: string; question: string; options: { id: string; text: string; count: number; mine: boolean }[]; total: number }) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      <p className="flex items-center gap-1.5 font-semibold">
        <BarChart3 className="size-4 text-olive-600" /> {question}
      </p>
      {options.map((o) => {
        const pct = total ? Math.round((o.count / total) * 100) : 0;
        return (
          <ActionButton key={o.id} action={votePoll} fields={{ id, option: o.id }} className={cn("relative h-10 w-full justify-between overflow-hidden rounded-xl border px-3 text-sm", o.mine ? "border-primary-400" : "border-line")}>
            <span className="absolute inset-y-0 left-0 bg-primary-100" style={{ width: `${pct}%` }} aria-hidden />
            <span className="relative font-medium">
              {o.mine && "✓ "}
              {o.text}
            </span>
            <span className="relative text-muted tabular-nums">{o.count}</span>
          </ActionButton>
        );
      })}
      <p className="text-xs text-muted">
        {total} vote{total === 1 ? "" : "s"} · tap to vote or change
      </p>
    </div>
  );
}

// ─── Composer ────────────────────────────────────────────────────────────────

export function ChatComposer({ channel, canPost, isParent, events }: { channel: Channel; canPost: boolean; isParent: boolean; events: { id: string; label: string }[] }) {
  const [key, setKey] = useState(0);
  const [preview, setPreview] = useState<{ kind: "photo" | "file"; name: string; url: string | null } | null>(null);
  // The Poll / Event windows' own "open" functions (handed over by FormModal).
  const openers = useRef<{ poll?: () => void; event?: () => void }>({});
  const setDialog = (what: "poll" | "event") => openers.current[what]?.();
  const { open: emojiOpen, setOpen: setEmojiOpen, ref: emojiRef } = usePopover();
  const { open: moreOpen, setOpen: setMoreOpen, ref: moreRef } = usePopover();
  const text = useRef<HTMLTextAreaElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const on = (e: Event) => openers.current[(e as CustomEvent<"poll" | "event">).detail]?.();
    window.addEventListener(OPEN, on);
    return () => window.removeEventListener(OPEN, on);
  }, []);

  if (!canPost)
    return (
      <p className="rounded-2xl bg-sunken px-4 py-3 text-center text-sm text-muted">
        {channel === "announcements" ? "Only parents post announcements. You can react to them." : "You can read this chat."}
      </p>
    );

  const insert = (s: string) => {
    const t = text.current;
    if (!t) return;
    const start = t.selectionStart ?? t.value.length;
    t.value = t.value.slice(0, start) + s + t.value.slice(t.selectionEnd ?? start);
    t.focus();
    t.selectionStart = t.selectionEnd = start + s.length;
  };

  return (
    <div className="flex flex-col gap-2">
      <ActionForm
        key={key}
        action={sendMessage}
        onSuccess={() => {
          setPreview(null);
          setKey((k) => k + 1);
        }}
        className="gap-2"
      >
        <input type="hidden" name="channel" value={channel} />
        <input
          ref={photoInput}
          type="file"
          name="photo"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            if (f && fileInput.current) fileInput.current.value = "";
            setPreview(f ? { kind: "photo", name: f.name, url: URL.createObjectURL(f) } : null);
          }}
        />
        <input
          ref={fileInput}
          type="file"
          name="file"
          accept="application/pdf,text/plain"
          className="hidden"
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            if (f && photoInput.current) photoInput.current.value = "";
            setPreview(f ? { kind: "file", name: f.name, url: null } : null);
          }}
        />

        {/* Photo · File · Poll · Event · More */}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
          <button type="button" className={chip} onClick={() => photoInput.current?.click()}>
            <ImageIcon className="size-4 text-sky-600" /> Photo
          </button>
          <button type="button" className={chip} onClick={() => fileInput.current?.click()}>
            <Paperclip className="size-4 text-primary-600" /> File
          </button>
          <button type="button" className={chip} onClick={() => setDialog("poll")}>
            <BarChart3 className="size-4 text-olive-600" /> Poll
          </button>
          <button type="button" className={chip} onClick={() => setDialog("event")}>
            <CalendarPlus className="size-4 text-wine-600" /> Event
          </button>
          <div ref={moreRef} className="relative">
            <button type="button" className={chip} aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)}>
              <MoreHorizontal className="size-4" /> More <ChevronDown className="size-3.5" />
            </button>
            {moreOpen && (
              <div className="fixed bottom-36 left-1/2 z-40 flex w-56 -translate-x-1/2 flex-col rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-pop)] sm:absolute sm:bottom-12 sm:left-auto sm:right-0 sm:translate-x-0">
                {isParent && channel !== "announcements" && (
                  <Link href="/messages?c=announcements" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[15px] hover:bg-sunken">
                    <Megaphone className="size-4 text-primary-600" /> Post an announcement
                  </Link>
                )}
                <Link href="/messages?c=pinned" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[15px] hover:bg-sunken">
                  <Pin className="size-4 text-primary-600" /> Pinned messages
                </Link>
                <Link href="/calendar" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[15px] hover:bg-sunken">
                  <CalendarPlus className="size-4 text-wine-600" /> Open the calendar
                </Link>
              </div>
            )}
          </div>
        </div>

        {preview && (
          <div className="flex w-fit items-center gap-2 rounded-xl border border-line bg-sunken p-1.5 pr-2 text-sm">
            {preview.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.url} alt="" className="size-14 rounded-lg object-cover" />
            ) : (
              <Paperclip className="ml-1 size-4" />
            )}
            <span className="max-w-[12rem] truncate">{preview.name}</span>
            <button
              type="button"
              aria-label="Remove"
              className="flex size-7 items-center justify-center rounded-full hover:bg-surface"
              onClick={() => {
                if (photoInput.current) photoInput.current.value = "";
                if (fileInput.current) fileInput.current.value = "";
                setPreview(null);
              }}
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex min-h-12 flex-1 items-end rounded-[1.5rem] border border-line-strong bg-surface pr-1 pl-1.5 focus-within:border-primary-400">
            <div ref={emojiRef} className="relative">
              <button type="button" aria-label="Emoji" onClick={() => setEmojiOpen((o) => !o)} className="m-1 flex size-9 items-center justify-center rounded-full text-muted hover:bg-sunken">
                <Smile className="size-5" />
              </button>
              {emojiOpen && (
                <div className="absolute bottom-12 left-0 z-40 grid w-72 grid-cols-8 gap-0.5 rounded-2xl border border-line bg-surface p-2 shadow-[var(--shadow-pop)]">
                  {EMOJI.map((e) => (
                    <button key={e} type="button" onClick={() => insert(e)} className="flex size-8 items-center justify-center rounded-lg text-xl hover:bg-sunken">
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <textarea
              ref={text}
              name="body"
              rows={1}
              placeholder={channel === "announcements" ? "Write an announcement…" : "Type a message…"}
              aria-label="Message"
              maxLength={4000}
              className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-1 py-2.5 text-[15px] outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(min-width: 640px)").matches) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = `${t.scrollHeight}px`;
              }}
            />
          </div>
          <SubmitButton pendingLabel=" " aria-label="Send" className="size-12 shrink-0 rounded-full p-0">
            <SendHorizontal className="size-5" />
          </SubmitButton>
        </div>
      </ActionForm>

      <FormModal title="New poll" action={sendPoll} submitLabel="Post poll" size="sm" trigger={(open) => ((openers.current.poll = open), null)}>
        <input type="hidden" name="channel" value={channel} />
        <TextField name="question" label="Question" required placeholder="What should we have for dinner Friday?" maxLength={200} />
        {[1, 2, 3, 4].map((n) => (
          <TextField key={n} name="option" label={`Choice ${n}${n > 2 ? " (optional)" : ""}`} placeholder={["Pizza", "Tacos", "Pasta", "Burgers"][n - 1]} maxLength={80} />
        ))}
      </FormModal>

      <FormModal title="Share an event" description="Post a calendar event so everyone sees it." action={shareEvent} submitLabel="Share" size="sm" trigger={(open) => ((openers.current.event = open), null)}>
        <input type="hidden" name="channel" value={channel} />
        {events.length ? (
          <>
            <SelectField name="eventId" label="Event" options={events.map((e) => ({ value: e.id, label: e.label }))} />
            <TextAreaField name="note" label="Note (optional)" rows={2} placeholder="Don't forget shin guards!" />
          </>
        ) : (
          <p className="text-sm text-muted">
            No upcoming family events in the next two weeks.{" "}
            <Link href="/calendar?new=1" className="font-medium text-primary-700 underline">
              Add one on the calendar
            </Link>
            .
          </p>
        )}
      </FormModal>
    </div>
  );
}
