"use client";

import { useActionState, useState } from "react";
import { Check, Copy } from "lucide-react";
import { addCalendarImport, saveFeedSettings } from "@/app/actions/calendar-sync";
import { Button } from "@/components/ui/button";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { MEMBER_COLORS, MEMBER_COLOR_KEYS } from "@/lib/colors";
import { cn } from "@/lib/utils";

export function CopyLink({ url }: { url: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-stretch gap-2">
      <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Your private calendar link" className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-sunken px-3 font-mono text-xs" />
      <Button
        variant="secondary"
        icon={done ? <Check className="size-4" /> : <Copy className="size-4" />}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
          } catch {
            /* older browsers: the field is selectable */
          }
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        }}
      >
        {done ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

/** What the subscribe link includes. */
export function FeedSettingsForm({ options, layers, onlyMine }: { options: { key: string; label: string }[]; layers: string[]; onlyMine: boolean }) {
  const [state, action] = useActionState(saveFeedSettings, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormMessage message={state?.message} tone={state?.ok ? "success" : "error"} />
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.key} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-line px-3 text-sm has-[:checked]:border-primary-400 has-[:checked]:bg-primary-50">
            <input type="checkbox" name="layers" value={o.key} defaultChecked={layers.includes(o.key)} className="size-4 accent-primary-600" />
            {o.label}
          </label>
        ))}
      </div>
      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input type="checkbox" name="onlyMine" defaultChecked={onlyMine} className="mt-0.5 size-5 accent-primary-600" />
        <span>
          <span className="font-medium">Only things I&apos;m part of</span>
          <span className="block text-muted">My events, my chores, my practices and games. Leave off to see the whole family.</span>
        </span>
      </label>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
      </div>
    </form>
  );
}

/** Bring in a Google / Outlook / iCloud calendar by its iCal link. */
export function ImportForm({ defaultColor }: { defaultColor: string }) {
  const [state, action] = useActionState(addCalendarImport, undefined);
  const [color, setColor] = useState(defaultColor);
  return (
    <form action={action} className="flex flex-col gap-3" key={state?.ok ? `done-${state.message}` : "form"}>
      <FormMessage message={state?.message ?? state?.errors?.url?.[0]} tone={state?.ok ? "success" : "error"} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        Calendar link
        <input name="url" required inputMode="url" autoComplete="off" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" className="h-11 rounded-xl border border-line-strong bg-surface px-3 font-normal" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Name
          <input name="name" maxLength={60} placeholder="Mom's work calendar" className="h-11 rounded-xl border border-line-strong bg-surface px-3 font-normal" />
        </label>
        <fieldset className="flex flex-col gap-1 text-sm font-medium">
          <legend className="mb-1">Who sees it</legend>
          <div className="flex gap-2">
            <label className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line font-normal has-[:checked]:border-primary-400 has-[:checked]:bg-primary-50">
              <input type="radio" name="shared" value="family" defaultChecked className="accent-primary-600" /> Whole family
            </label>
            <label className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line font-normal has-[:checked]:border-primary-400 has-[:checked]:bg-primary-50">
              <input type="radio" name="shared" value="private" className="accent-primary-600" /> Only me
            </label>
          </div>
        </fieldset>
      </div>
      <input type="hidden" name="color" value={color} />
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Color">
        <span className="text-sm font-medium">Color</span>
        {MEMBER_COLOR_KEYS.slice(0, 14).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={color === k} aria-label={MEMBER_COLORS[k].label} onClick={() => setColor(k)} className={cn("size-8 rounded-full border border-black/10", color === k && "ring-2 ring-ink ring-offset-2")} style={{ backgroundColor: MEMBER_COLORS[k].solid }} />
        ))}
      </div>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Connecting…">Add calendar</SubmitButton>
      </div>
    </form>
  );
}
