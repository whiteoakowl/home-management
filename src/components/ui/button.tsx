import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "soft";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-medium transition-colors select-none disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary: "bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 shadow-sm",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-sunken",
  soft: "bg-primary-50 text-primary-700 hover:bg-primary-100",
  ghost: "text-ink-soft hover:bg-sunken hover:text-ink",
  danger: "bg-wine-500 text-white hover:bg-wine-700",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-[15px]",
  lg: "h-12 px-6 text-base",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

type CommonProps = { variant?: Variant; size?: Size; icon?: ReactNode; className?: string };

export function Button({
  variant,
  size,
  icon,
  className,
  children,
  type = "button",
  ...props
}: CommonProps & ComponentProps<"button">) {
  return (
    <button type={type} className={buttonClasses({ variant, size, className })} {...props}>
      {icon}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  icon,
  className,
  children,
  ...props
}: CommonProps & ComponentProps<typeof Link>) {
  return (
    <Link className={buttonClasses({ variant, size, className })} {...props}>
      {icon}
      {children}
    </Link>
  );
}

export function IconButton({
  label,
  className,
  children,
  type = "button",
  ...props
}: { label: string } & ComponentProps<"button">) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-sunken hover:text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
