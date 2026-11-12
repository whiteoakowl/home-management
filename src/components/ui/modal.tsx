"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Native <dialog> modal. Centred card on desktop, bottom sheet on mobile.
 * Escape and backdrop clicks close it.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-[var(--radius-card)] bg-surface p-0 text-ink shadow-[var(--shadow-pop)]",
        "sm:m-auto sm:rounded-[var(--radius-card)]",
        { sm: "sm:max-w-md", md: "sm:max-w-xl", lg: "sm:max-w-3xl" }[size],
      )}
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 pt-5 pb-4 sm:px-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold">{title}</h2>
              {description && <p className="text-sm text-muted">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mt-1 -mr-2 inline-flex size-10 items-center justify-center rounded-full text-muted hover:bg-sunken hover:text-ink"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          {footer && <div className="pb-safe flex justify-end gap-2 border-t border-line px-5 pt-4 sm:px-6 sm:pb-4">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
