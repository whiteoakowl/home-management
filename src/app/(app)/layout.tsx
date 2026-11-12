import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications, MODULES } from "@/db/schema";
import { MobileNav } from "@/components/shell/mobile-nav";
import { buildNav } from "@/components/shell/nav";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { getViewer, listFamilyMembers } from "@/lib/dal";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  const [members, [unread]] = await Promise.all([
    listFamilyMembers(viewer.family.id),
    db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.memberId, viewer.member.id), isNull(notifications.readAt))),
  ]);
  const sections = buildNav(viewer);
  const editable = MODULES.filter((m) => viewer.can(m, "edit"));
  const pick = (m: (typeof members)[number]) => ({ id: m.id, displayName: m.displayName, color: m.color });

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
        Skip to content
      </a>
      <Sidebar sections={sections} familyName={viewer.family.name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          me={pick(viewer.member)}
          members={members.map(pick)}
          isParent={viewer.isParent}
          unread={unread?.n ?? 0}
          editable={editable}
        />
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-28 sm:px-6 sm:pb-12 lg:px-8 lg:pt-8">
          {children}
        </main>
      </div>
      <MobileNav
        sections={sections}
        editable={editable}
        isParent={viewer.isParent}
        canCalendar={viewer.can("calendar")}
        canLists={viewer.can("lists")}
      />
    </div>
  );
}
