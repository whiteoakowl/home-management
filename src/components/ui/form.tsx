"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps, ReactNode } from "react";
import { ChevronDown, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

const control =
  "w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-3.5 text-[15px] text-ink placeholder:text-muted/70 transition-colors focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-100 aria-[invalid=true]:border-wine-500";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | string[];
  children: ReactNode;
  className?: string;
}) {
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink-soft">
        {label}
      </label>
      {children}
      {message ? (
        <p className="text-sm text-wine-700" role="alert">
          {message}
        </p>
      ) : hint ? (
        <p className="text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24 py-2.5", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(control, "h-11 appearance-none pr-10", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  );
}

export function Checkbox({
  label,
  description,
  className,
  ...props
}: { label: ReactNode; description?: ReactNode } & ComponentProps<"input">) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl p-2 hover:bg-sunken", className)}>
      <input
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 cursor-pointer rounded-md accent-primary-600"
        {...props}
      />
      <span className="flex flex-col">
        <span className="text-[15px] text-ink">{label}</span>
        {description && <span className="text-sm text-muted">{description}</span>}
      </span>
    </label>
  );
}

/** Accessible on/off switch backed by a real checkbox, so it posts with forms. */
export function Toggle({
  label,
  description,
  className,
  ...props
}: { label: ReactNode; description?: ReactNode } & Omit<ComponentProps<"input">, "type">) {
  return (
    <label className={cn("flex cursor-pointer items-center justify-between gap-4 py-2", className)}>
      <span className="flex flex-col">
        <span className="text-[15px] font-medium text-ink">{label}</span>
        {description && <span className="text-sm text-muted">{description}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" role="switch" className="peer sr-only" {...props} />
        <span className="h-7 w-12 rounded-full bg-line-strong transition-colors peer-checked:bg-primary-500 peer-focus-visible:ring-4 peer-focus-visible:ring-primary-100" />
        <span className="absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

export function FormMessage({ message, tone = "error" }: { message?: string; tone?: "error" | "success" }) {
  if (!message) return null;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-[var(--radius-control)] px-3.5 py-2.5 text-sm",
        tone === "error" ? "bg-wine-50 text-wine-700" : "bg-primary-50 text-primary-700",
      )}
    >
      {message}
    </p>
  );
}
