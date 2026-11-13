"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand, BrandMark } from "@/components/brand";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { InstallAppButton } from "@/components/pwa/install-app";
import type { NavSection } from "./nav";

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop sidebar (lg+) and tablet icon rail (sm–lg). */
export function Sidebar({ sections, familyName }: { sections: NavSection[]; familyName: string }) {
  const pathname = usePathname();
  return (
    <aside className="hidden shrink-0 border-r border-line bg-surface/70 sm:block sm:w-[76px] lg:w-64 print:hidden">
      <div className="sticky top-0 flex h-dvh flex-col">
      <div className="flex h-16 items-center px-4 lg:px-5">
        <Link href="/" aria-label={`${familyName} Family`} className="hidden lg:block">
          <Brand />
        </Link>
        <Link href="/" aria-label="Home" className="mx-auto lg:hidden">
          <BrandMark />
        </Link>
      </div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-6">
        {sections.map((s) => (
          <div key={s.group} className="mt-5 first:mt-2">
            <p className="mb-1.5 hidden px-3 text-[11px] font-semibold tracking-[0.14em] text-muted uppercase lg:block">{s.group}</p>
            <ul className="flex flex-col gap-0.5">
              {s.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? (pathname === item.href ? "page" : "location") : undefined}
                      title={item.label}
                      className={cn(
                        "group flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors max-lg:justify-center",
                        active ? "bg-primary-600 text-white shadow-sm" : "text-ink-soft hover:bg-primary-50 hover:text-primary-700",
                      )}
                    >
                      <Icon name={item.icon} className="size-5 shrink-0" />
                      <span className="hidden lg:inline">{item.label}</span>
                    </Link>
                    {active && item.children && (
                      <ul className="mt-1 mb-2 ml-6 hidden flex-col border-l border-line pl-3 lg:flex" aria-label={`${item.label} sections`}>
                        {item.children.map((c) => {
                          const on = c.href === item.href ? pathname === c.href : isActive(pathname, c.href);
                          return (
                            <li key={c.href}>
                              <Link
                                href={c.href}
                                aria-current={on ? "page" : undefined}
                                className={cn("block rounded-lg px-2.5 py-1.5 text-sm", on ? "font-semibold text-primary-700" : "text-ink-soft hover:bg-primary-50 hover:text-primary-700")}
                              >
                                {c.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-line p-3">
        <InstallAppButton
          label="Install app"
          className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[15px] font-medium text-ink-soft hover:bg-primary-50 hover:text-primary-700 max-lg:justify-center max-lg:[&>span]:sr-only"
        />
      </div>
      </div>
    </aside>
  );
}
