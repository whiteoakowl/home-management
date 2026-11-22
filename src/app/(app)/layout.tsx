import type { Metadata } from "next";
import { familyMembersFor } from "@/lib/names";
import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications, MODULES, users } from "@/db/schema";
import { MobileNav } from "@/components/shell/mobile-nav";
import { buildNav } from "@/components/shell/nav";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { getViewer } from "@/lib/dal";
import { familyAccess, isPlatformAdmin } from "@/lib/billing";
import { unreadMessages } from "@/lib/hub";
import { LegalFooter } from "@/components/legal-footer";
import { VerifyEmailBanner } from "@/components/verify-email-banner";
import { emailConfigured } from "@/lib/email";
import { getBrand } from "@/lib/billing";
import Link from "next/link";
import { runDailyAutomation } from "@/lib/automation";
import { themeStyle } from "@/lib/theme";
import { PlanBanner, type LockedArea } from "@/components/billing/plan-banner";
import { PlanProvider } from "@/components/billing/plan-context";
import { MODULE_META } from "@/lib/modules";
import { isPremiumModule } from "@/lib/plan-tiers";
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
  // Families without a paid plan use the Free plan (Premium sections are read-only).
  const billing = await familyAccess(viewer.family.id);
  // Recurring chores, reminders, low-stock → shopping… (once per family per day).
  await runDailyAutomation(viewer.family);
  const [members, [unread]] = await Promise.all([
    familyMembersFor(viewer),
    db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.memberId, viewer.member.id), isNull(notifications.readAt))),
  ]);
  const sections = buildNav(viewer);
  const holderName = members.find((m) => m.id === viewer.family.ownerMemberId)?.displayName ?? "the account holder";
  // The account holder confirms their email once email sending is set up.
  const unverifiedEmail =
    viewer.isOwner && emailConfigured() ? ((await db.select({ v: users.emailVerifiedAt }).from(users).where(eq(users.id, viewer.user.id)))[0]?.v ? null : viewer.user.email) : null;
  const unreadChat = viewer.can("messages") ? await unreadMessages(viewer.family.id, viewer.member.id, viewer.isParent) : 0;
  // Quick Add: modules the member can add to (Family Pantry areas accept the "Add" level).
  // "Use" adds your own things in every area.
  const editable = MODULES.filter((m) => viewer.can(m, "use"));
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
          <PlanBanner tier={billing.tier} trialDaysLeft={billing.trialDaysLeft} isOwner={viewer.isOwner} isParent={viewer.isParent} holder={holderName} locked={lockedAreas(viewer.premium)} />
          {viewer.isParent && billing.billingOn && (billing.status === "past_due" || (billing.status === "trialing" && billing.row?.trialEndsAt)) && (
            <Link
              href="/settings/billing"
              className={`mb-5 block rounded-xl px-4 py-2.5 text-sm ${billing.status === "past_due" ? "bg-wine-50 text-wine-700" : "bg-primary-50 text-primary-700"}`}
            >
              {billing.status === "past_due"
                ? "We couldn't charge your card. Update it to keep your family's app running →"
                : `Free trial: ${trialLeft(billing.row!.trialEndsAt!)} left. Your plan starts automatically; manage it in Account settings →`}
            </Link>
          )}
          {unverifiedEmail && <VerifyEmailBanner email={unverifiedEmail} />}
          <PlanProvider premium={viewer.premium}>{children}</PlanProvider>
          <LegalFooter brand={await getBrand()} className="mt-12 print:hidden" />
        </main>
      </div>
      <MobileNav
        sections={sections}
        editable={editable}
        isParent={viewer.isParent}
        canCalendar={viewer.can("calendar")}
        canLists={viewer.can("lists")}
        shoppingHref={viewer.can("shopping") ? "/shopping" : viewer.member.privateFood ? "/shopping?space=mine" : null}
      />
    </div>
  );
}

/** Pages that are Premium (view-only on the Free plan). */
function lockedAreas(premium: boolean): LockedArea[] {
  if (premium) return [];
  const areas: LockedArea[] = Object.values(MODULE_META)
    .filter((m) => isPremiumModule(m.id))
    .map((m) => ({ href: m.href, label: m.label, exact: m.id === "house" }));
  return [
    ...areas,
    { href: "/house/documents", label: "House" },
    { href: "/health/period", label: "Period Tracker" },
    { href: "/photos", label: "Photo albums" },
    { href: "/calendar/templates", label: "Event templates" },
    { href: "/calendar/sync", label: "Calendar sync" },
    { href: "/house/rewards", label: "Chore rewards" },
  ];
}

function trialLeft(end: Date) {
  const days = Math.max(0, Math.ceil((+end - Date.now()) / 86400000));
  return days === 1 ? "1 day" : `${days} days`;
}
