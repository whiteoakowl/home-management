"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CalendarDays, ClipboardList, LayoutDashboard, Menu } from "lucide-react";
import type { Module } from "@/db/schema/_shared";
import { Icon } from "@/components/icons";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import type { NavSection } from "./nav";
import { QuickAdd } from "./quick-add";
import { isActive } from "./sidebar";

/** Bottom tab bar for phones: Home · Calendar · [+] · Lists · More. */
export function MobileNav({
  sections,
  editable,
  isParent,
  canCalendar,
  canLists,
}: {
  sections: NavSection[];
  editable: Module[];
  isParent: boolean;
  canCalendar: boolean;
  canLists: boolean;
}) {
  const pathname = usePathname();
  const [more, setMore] = useState(false);

  const tab = (href: string, label: string, icon: React.ReactNode, enabled = true) =>
    enabled ? (
      <Link
        href={href}
        aria-current={isActive(pathname, href) ? "page" : undefined}
        className={cn(
          "flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium",
          isActive(pathname, href) ? "text-primary-600" : "text-muted",
        )}
      >
        {icon}
        {label}
      </Link>
    ) : (
      <span className="flex-1" />
    );

  return (
    <>
      <nav
        aria-label="Primary"
        className="pb-safe fixed inset-x-0 bottom-0 z-30 flex items-end border-t border-line bg-surface/95 px-2 pt-1 backdrop-blur sm:hidden print:hidden"
      >
        {tab("/", "Home", <LayoutDashboard className="size-6" />)}
        {tab("/calendar", "Calendar", <CalendarDays className="size-6" />, canCalendar)}
        <div className="flex flex-1 justify-center">
          <QuickAdd editable={editable} isParent={isParent} variant="fab" />
        </div>
        {tab("/lists", "Lists", <ClipboardList className="size-6" />, canLists)}
        <button type="button" onClick={() => setMore(true)} className="flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium text-muted">
          <Menu className="size-6" />
          More
        </button>
      </nav>
      <Modal open={more} onClose={() => setMore(false)} title="Everything" size="lg">
        <div className="flex flex-col gap-5">
          {sections.map((s) => (
            <div key={s.group}>
              <p className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">{s.group}</p>
              <ul className="grid grid-cols-3 gap-2">
                {s.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMore(false)}
                      className={cn(
                        "flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border p-2 text-[13px] font-medium",
                        isActive(pathname, item.href) ? "border-primary-300 bg-primary-50 text-primary-700" : "border-line",
                      )}
                    >
                      <Icon name={item.icon} className="size-6" />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
