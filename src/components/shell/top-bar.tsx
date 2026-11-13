import Link from "next/link";
import { Bell, KeyRound, LogOut, Search, Settings, UserRound } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { BrandMark } from "@/components/brand";
import { Avatar } from "@/components/ui/display";
import type { Module } from "@/db/schema/_shared";
import { Menu, MenuItem } from "./menu";
import { QuickAdd } from "./quick-add";

type M = { id: string; displayName: string; color: string };

export function TopBar({
  me,
  members,
  isParent,
  unread,
  editable,
}: {
  me: M;
  members: M[];
  isParent: boolean;
  unread: number;
  editable: Module[];
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 print:hidden items-center gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur sm:px-6 lg:px-8">
      <Link href="/" className="sm:hidden" aria-label="Home">
        <BrandMark className="size-8" />
      </Link>

      {/* Parents can jump into any member's portal. */}
      {isParent && members.length > 1 && (
        <div className="hidden items-center gap-1 md:flex" aria-label="Family member portals">
          <span className="mr-1 text-sm text-muted">View as</span>
          {members.map((m) => (
            <Link key={m.id} href={`/family/${m.id}`} title={`${m.displayName}'s portal`} className="rounded-full transition-transform hover:-translate-y-0.5">
              <Avatar name={m.displayName} color={m.color} size="sm" />
              <span className="sr-only">{m.displayName}&apos;s portal</span>
            </Link>
          ))}
        </div>
      )}

      <form action="/search" role="search" className="relative ml-auto hidden max-w-xs flex-1 lg:block">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <label htmlFor="topbar-search" className="sr-only">
          Search
        </label>
        <input id="topbar-search" name="q" placeholder="Search everything…" className="h-10 w-full rounded-full border border-line bg-surface pr-3 pl-9 text-sm focus:border-primary-500 focus:ring-4 focus:ring-primary-100 focus:outline-none" />
      </form>
      <div className="ml-auto flex items-center gap-1 sm:gap-2 lg:ml-0">
        <Link href="/search" aria-label="Search" className="inline-flex size-11 items-center justify-center rounded-full text-ink-soft hover:bg-sunken lg:hidden">
          <Search className="size-5" />
        </Link>
        <div className="hidden sm:block">
          <QuickAdd editable={editable} isParent={isParent} />
        </div>
        <Link
          href="/notifications"
          aria-label={unread ? `Notifications (${unread} unread)` : "Notifications"}
          className="relative inline-flex size-11 items-center justify-center rounded-full text-ink-soft hover:bg-sunken hover:text-ink"
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute top-2 right-2 flex min-w-4 items-center justify-center rounded-full bg-wine-500 px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
        <Menu
          label="Account"
          trigger={<Avatar name={me.displayName} color={me.color} size="md" />}
        >
          <div className="border-b border-line px-3 pt-2 pb-3">
            <p className="font-semibold">{me.displayName}</p>
            <p className="text-sm text-muted">{isParent ? "Parent" : "Family member"}</p>
          </div>
          <MenuItem href={`/family/${me.id}`} icon={<UserRound className="size-4" />}>My home</MenuItem>
          <MenuItem href="/account" icon={<KeyRound className="size-4" />}>Account & password</MenuItem>
          {isParent && <MenuItem href="/settings" icon={<Settings className="size-4" />}>Settings</MenuItem>}
          <form action={logout}>
            <MenuItem as="button" icon={<LogOut className="size-4" />}>Sign out</MenuItem>
          </form>
        </Menu>
      </div>
    </header>
  );
}
