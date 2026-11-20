import type { Metadata } from "next";
import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications, MODULES } from "@/db/schema";
import { MobileNav } from "@/components/shell/mobile-nav";
import { buildNav } from "@/components/shell/nav";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { getViewer, listFamilyMembers } from "@/lib/dal";
import { familyAccess, isPlatformAdmin } from "@/lib/billing";
import { redirect } from "next/navigation";
import { unreadMessages } from "@/lib/hub";
import { LegalFooter } from "@/components/legal-footer";
import { getBrand } from "@/lib/billing";
import Link from "next/link";
import { runDailyAutomation } from "@/lib/automation";
import { themeStyle } from "@/lib/theme";
import { fileUrl } from "@/lib/files";

/** Inside the app, the home-screen title is the family's own name (iPhone and Android). */
export async function generateMetadata(): Promise<Metadata> {
  const viewer = await getViewer();
  return {
    manifest: `/api/manifest?f=${viewer.family.id}`,
    applicationName: `${viewer.family.name} Family`,
    appleWebApp: { capable: true, title: viewer.family.name, statusBarStyle: "default" },
  };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  // Families without a subscription (or free trial) choose a plan first.
  const billing = await familyAccess(viewer.family.id);
  if (!billing.hasAccess) redirect("/billing");
  // Recurring chores, reminders, low-stock → shopping… (once per family per day).
  await runDailyAutomation(viewer.family);
  const [members, [unread]] = await Promise.all([
    listFamilyMembers(viewer.family.id),
    db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.memberId, viewer.member.id), isNull(notifications.readAt))),
  ]);
  const sections = buildNav(viewer);
  const unreadChat = viewer.can("messages") ? await unreadMessages(viewer.family.id, viewer.member.id) : 0;
  // Quick Add: modules the member can add to (Family Pantry areas accept the "Add" level).
  // Areas where "Use" can already add their own things; the rest still need Add & edit.
  const USE_ADDS: readonly string[] = ["kitchen", "recipes", "meals", "shopping", "calendar", "chores", "cleaning", "plans", "work", "dance", "sports"];
  const editable = MODULES.filter((m) => viewer.can(m, USE_ADDS.includes(m) ? "use" : "edit"));
  const pick = (m: (typeof members)[number]) => ({ id: m.id, displayName: m.displayName, color: m.color, photoUrl: fileUrl(m.avatarFileId, true) });

  return (
    <div className="flex min-h-dvh" style={themeStyle(viewer.member.appTheme ?? viewer.family.theme?.accent)}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
        Skip to content
      </a>
      <Sidebar sections={sections} familyName={viewer.family.name} badges={unreadChat ? { "/messages": unreadChat } : undefined} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          platformAdmin={isPlatformAdmin(viewer.user.email)}
          me={pick(viewer.member)}
          members={members.map(pick)}
          isParent={viewer.isParent}
          unread={unread?.n ?? 0}
          editable={editable}
        />
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-28 sm:px-6 sm:pb-12 lg:px-8 lg:pt-8">
          {viewer.isParent && billing.billingOn && (billing.status === "past_due" || (billing.status === "trialing" && billing.row?.trialEndsAt)) && (
            <Link
              href="/settings/billing"
              className={`mb-5 block rounded-xl px-4 py-2.5 text-sm ${billing.status === "past_due" ? "bg-wine-50 text-wine-700" : "bg-primary-50 text-primary-700"}`}
            >
              {billing.status === "past_due"
                ? "We couldn't charge your card. Update it to keep your family's app running →"
                : `Free trial: ${trialLeft(billing.row!.trialEndsAt!)} left. Your plan starts automatically; manage it in Settings →`}
            </Link>
          )}
          {children}
          <LegalFooter brand={await getBrand()} className="mt-12 print:hidden" />
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

function trialLeft(end: Date) {
  const days = Math.max(0, Math.ceil((+end - Date.now()) / 86400000));
  return days === 1 ? "1 day" : `${days} days`;
}
