import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  icon,
  action,
  href,
  hrefLabel = "View all",
  className,
}: {
  title: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  href?: string;
  hrefLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-center justify-between gap-3", className)}>
      <h2 className="flex min-w-0 items-center gap-2.5 font-sans text-[15px] font-semibold">
        {icon && (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600">
            {icon}
          </span>
        )}
        <span className="truncate">{title}</span>
      </h2>
      {action}
      {href && !action && (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-0.5 text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          {hrefLabel}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}
