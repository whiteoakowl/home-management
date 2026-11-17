"use client";

import { useTransition, type ReactNode } from "react";
import { Check, LoaderCircle, Trash2 } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { networkFailureMessage } from "@/lib/shrink-image";
import { cn } from "@/lib/utils";

type VoidAction = (formData: FormData) => Promise<void>;

/** Run a void action; a dropped request shows a short alert instead of an error page. */
export async function runVoid(action: VoidAction, fd: FormData) {
  try {
    await action(fd);
  } catch (e) {
    unstable_rethrow(e);
    console.error(e);
    window.alert(navigator.onLine === false ? networkFailureMessage() : "That didn't save. You may not have permission to do this, or the connection dropped. Please try again.");
  }
}

/** Submit a tiny form (hidden fields) to a void server action, with optional confirm. */
export function ActionButton({
  action,
  fields,
  children,
  confirm,
  className,
  label,
  title,
}: {
  action: VoidAction;
  fields: Record<string, string | number | boolean | null | undefined>;
  children: ReactNode;
  confirm?: string;
  className?: string;
  label?: string;
  title?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      disabled={pending}
      className={cn("inline-flex items-center justify-center gap-1.5 disabled:opacity-50", className)}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        const fd = new FormData();
        for (const [k, v] of Object.entries(fields)) if (v !== null && v !== undefined) fd.set(k, String(v));
        start(() => runVoid(action, fd));
      }}
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : children}
    </button>
  );
}

export function DeleteButton({
  action,
  fields,
  what = "this",
  className,
}: {
  action: VoidAction;
  fields: Record<string, string | number | null | undefined>;
  what?: string;
  className?: string;
}) {
  return (
    <ActionButton
      action={action}
      fields={fields}
      confirm={`Delete ${what}? This can't be undone.`}
      label={`Delete ${what}`}
      className={cn("size-9 rounded-full text-muted hover:bg-wine-50 hover:text-wine-500", className)}
    >
      <Trash2 className="size-4" />
    </ActionButton>
  );
}

/**
 * Big, touch-friendly completion checkbox with optimistic feel.
 * Calls `action` with { id, done }.
 */
export function CheckCircle({
  action,
  id,
  done,
  label,
  extra,
  size = "md",
  disabled = false,
}: {
  action: VoidAction;
  id: string;
  done: boolean;
  label: string;
  extra?: Record<string, string>;
  size?: "sm" | "md";
  /** Shown but not clickable (e.g. "View only" access). */
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const shown = pending ? !done : done;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={shown}
      aria-label={label}
      aria-disabled={disabled || undefined}
      title={disabled ? "View only: you can't check this off" : undefined}
      disabled={pending || disabled}
      onClick={() => {
        const fd = new FormData();
        fd.set("id", id);
        fd.set("done", String(!done));
        for (const [k, v] of Object.entries(extra ?? {})) fd.set(k, v);
        start(() => runVoid(action, fd));
      }}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border-2 transition-all",
        size === "md" ? "size-7" : "size-6",
        shown ? "border-primary-600 bg-primary-600 text-white" : "border-line-strong bg-surface hover:border-primary-400",
        disabled && "cursor-not-allowed opacity-50 hover:border-line-strong",
      )}
    >
      {shown && <Check className={size === "md" ? "size-4" : "size-3.5"} strokeWidth={3} aria-hidden />}
    </button>
  );
}
