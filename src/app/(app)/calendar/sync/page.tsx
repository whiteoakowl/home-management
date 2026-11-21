import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarArrowDown, CalendarArrowUp, Eye, EyeOff, RefreshCw, RotateCcw } from "lucide-react";
import { refreshCalendarImport, removeCalendarImport, resetFeed, toggleImportShared } from "@/app/actions/calendar-sync";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { CopyLink, FeedSettingsForm, ImportForm } from "@/components/calendar/sync-forms";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/display";
import { feedFor, FEED_EXCLUDED, visibleImports } from "@/lib/calendar-sync";
import { LAYERS } from "@/lib/calendar";
import { memberColor } from "@/lib/colors";
import { getViewer } from "@/lib/dal";
import { relativeTime } from "@/lib/dates";
import { familyFaiths } from "@/lib/faith-config";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = { title: "Calendar sync" };

const LABEL: Record<string, string> = {
  events: "Events",
  plans: "Plans & trips",
  chores: "Chores",
  workouts: "Workouts",
  dance: "Dance",
  sports: "Sports",
  work: "Work shifts",
  vehicles: "Vehicles",
  meals: "Dinner plan",
  garden: "Garden",
  farm: "Farm",
  pets: "Pets",
  home: "Home projects",
  moon: "Moon & sabbats",
  christian: "Christian holidays",
  catholic: "Catholic feasts",
  jewish: "Jewish holidays",
  hindu: "Hindu holidays",
  buddhist: "Buddhist holidays",
};

const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold hover:border-primary-300 hover:bg-primary-50";

function Steps({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="rounded-xl border border-line px-4 py-3 text-sm [&[open]]:bg-sunken/50">
      <summary className="cursor-pointer font-semibold">{title}</summary>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink-soft">{children}</ol>
    </details>
  );
}

export default async function CalendarSyncPage() {
  const viewer = await getViewer();
  if (!viewer.can("calendar")) notFound();
  const [feed, imports, base] = await Promise.all([feedFor(viewer), visibleImports(viewer), siteUrl()]);
  const https = `${base}/api/calendar/feed/${feed.token}.ics`;
  const webcal = https.replace(/^https?:\/\//, "webcal://");
  const calName = `${viewer.family.name} Family`;
  const faiths = familyFaiths(viewer.family);
  const options = LAYERS.filter((l) => !FEED_EXCLUDED.includes(l) && LABEL[l] && (!["christian", "catholic", "jewish", "hindu", "buddhist"].includes(l) || (faiths as string[]).includes(l))).map((l) => ({ key: l, label: LABEL[l]! }));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/calendar" className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline">
        <ArrowLeft className="size-4" /> Calendar
      </Link>
      <PageHeader help="calendar-sync" eyebrow="Calendar" title="Sync with Google, Outlook & Apple" description="See the family calendar in the calendar app you already use, and bring your other calendars in here." />

      <Card>
        <CardHeader title="1. Family calendar → your calendar app" icon={<CalendarArrowUp className="size-4" />} />
        <p className="mb-4 text-[15px] text-muted">Subscribe once and the family calendar shows up in your phone&apos;s calendar, updating by itself. It shows what you can see in the app. Changes are made here, in the app.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <a href={webcal} className={btn}>
            Apple Calendar (iPhone, iPad, Mac)
          </a>
          <a href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noreferrer" className={btn}>
            Google Calendar
          </a>
          <a href={`https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(https)}&name=${encodeURIComponent(calName)}`} target="_blank" rel="noreferrer" className={btn}>
            Outlook.com / Hotmail
          </a>
          <a href={`https://outlook.office.com/calendar/0/addfromweb?url=${encodeURIComponent(https)}&name=${encodeURIComponent(calName)}`} target="_blank" rel="noreferrer" className={btn}>
            Outlook (work or school)
          </a>
        </div>
        <p className="mt-4 mb-1 text-sm font-medium">Or copy your private link:</p>
        <CopyLink url={https} />
        <div className="mt-4 flex flex-col gap-2">
          <Steps title="Google Calendar on Android or iPhone">
            <li>Google only lets you add a link from a computer or from Chrome on your phone in &ldquo;Desktop site&rdquo; mode: tap the Google Calendar button above, or open calendar.google.com, then <strong>Other calendars → + → From URL</strong> and paste your link.</li>
            <li>In the Google Calendar app: <strong>Settings</strong> → tap the new calendar → turn on <strong>Sync</strong>.</li>
            <li>Google refreshes subscribed calendars on its own schedule (usually every few hours).</li>
          </Steps>
          <Steps title="Apple Calendar (iPhone, iPad)">
            <li>Tap <strong>Apple Calendar</strong> above, then <strong>Subscribe</strong>.</li>
            <li>Or: Settings → Apps → Calendar → Calendar Accounts → Add Account → Other → <strong>Add Subscribed Calendar</strong> → paste your link.</li>
            <li>To refresh more often: Settings → Apps → Calendar → Calendar Accounts → Fetch New Data.</li>
          </Steps>
          <Steps title="Outlook (phone app or computer)">
            <li>Tap the Outlook button above and choose <strong>Import</strong>, or in Outlook on the web: <strong>Add calendar → Subscribe from web</strong> → paste your link.</li>
            <li>It appears in the Outlook phone app too. Outlook refreshes every few hours.</li>
          </Steps>
        </div>
        <details className="mt-4 rounded-xl border border-line px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold">What to include</summary>
          <div className="mt-3">
            <FeedSettingsForm options={options} layers={feed.layers} onlyMine={feed.onlyMine} />
          </div>
        </details>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-sm text-muted">
          <span>{feed.lastFetchedAt ? `Last checked by a calendar app ${relativeTime(feed.lastFetchedAt)}.` : "Not added to a calendar app yet."} Keep this link private: anyone with it can see your calendar.</span>
          <ActionButton action={resetFeed} fields={{}} confirm="Make a new link? Calendars using the old link stop updating, and you'll need to subscribe again." className="h-9 rounded-full px-3 font-medium text-ink-soft hover:bg-sunken">
            <RotateCcw className="size-4" /> New link
          </ActionButton>
        </div>
      </Card>

      <Card>
        <CardHeader title="2. Your calendars → the family calendar" icon={<CalendarArrowDown className="size-4" />} />
        <p className="mb-4 text-[15px] text-muted">Show your Google, Outlook or iCloud calendar (work, school, sports league…) on the family calendar. It stays in sync automatically; make changes in the original calendar.</p>
        <div className="mb-4 flex flex-col gap-2">
          <Steps title="Get the link from Google Calendar">
            <li>On a computer (or Chrome &ldquo;Desktop site&rdquo; on your phone), open <strong>calendar.google.com</strong>.</li>
            <li>Gear icon → <strong>Settings</strong> → on the left, click the calendar under &ldquo;Settings for my calendars&rdquo;.</li>
            <li>Scroll to <strong>Integrate calendar</strong> and copy <strong>Secret address in iCal format</strong>.</li>
          </Steps>
          <Steps title="Get the link from Outlook">
            <li>Outlook on the web: <strong>Settings → Calendar → Shared calendars</strong>.</li>
            <li>Under <strong>Publish a calendar</strong>, choose the calendar and &ldquo;Can view all details&rdquo;, then <strong>Publish</strong>.</li>
            <li>Copy the <strong>ICS</strong> link. (Some work accounts don&apos;t allow publishing.)</li>
          </Steps>
          <Steps title="Get the link from iCloud (Apple Calendar)">
            <li>On iPhone: open <strong>Calendar</strong> → <strong>Calendars</strong> → tap ⓘ next to the calendar.</li>
            <li>Turn on <strong>Public Calendar</strong>, then <strong>Share Link → Copy</strong>.</li>
            <li>Note: anyone with a public link can view that calendar, so only share calendars you&apos;re comfortable with.</li>
          </Steps>
        </div>
        <ImportForm defaultColor={viewer.member.color} />

        {imports.length > 0 && (
          <ul className="mt-5 divide-y divide-line border-t border-line">
            {imports.map((im) => {
              const mine = im.memberId === viewer.member.id || viewer.isParent;
              return (
                <li key={im.id} className="flex items-center gap-3 py-3">
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: memberColor(im.color).solid }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {im.name} {!im.shared && <Badge>Only me</Badge>}
                    </p>
                    <p className="text-xs text-muted">
                      {im.events.length} event{im.events.length === 1 ? "" : "s"}
                      {im.fetchedAt && ` · synced ${relativeTime(im.fetchedAt)}`}
                    </p>
                    {im.lastError && <p className="text-xs text-wine-700">Last try: {im.lastError}</p>}
                  </div>
                  {mine && (
                    <span className="flex shrink-0 items-center">
                      <ActionButton action={refreshCalendarImport} fields={{ id: im.id }} label="Sync now" className="size-9 rounded-full text-muted hover:bg-sunken">
                        <RefreshCw className="size-4" />
                      </ActionButton>
                      <ActionButton action={toggleImportShared} fields={{ id: im.id }} label={im.shared ? "Make it only mine" : "Share with the family"} className="size-9 rounded-full text-muted hover:bg-sunken">
                        {im.shared ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </ActionButton>
                      <DeleteButton action={removeCalendarImport} fields={{ id: im.id }} what={`"${im.name}" from the family calendar`} />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
