import type { Module } from "@/db/schema/_shared";
import { BASICS } from "./articles/basics";
import { EVERYDAY } from "./articles/everyday";
import { LIFE } from "./articles/life";
import { SETTINGS } from "./articles/settings";
import type { HelpArticle, HelpAudience, HelpCategory, HelpCategoryKey, HelpFaq } from "./types";

export type { HelpArticle, HelpCategory, HelpCategoryKey, HelpFaq } from "./types";

/** Categories, in the order the Help Center shows them. Icons are lucide names (see components/icons). */
export const CATEGORIES: HelpCategory[] = [
  { key: "getting-started", title: "Getting started", description: "First steps, finding your way around, and installing the app.", icon: "Sparkles" },
  { key: "account", title: "Account & profile", description: "Your profile, password, email, and Account settings.", icon: "UserRound" },
  { key: "family", title: "Family & members", description: "Adding people, logins, and who can see what.", icon: "Users" },
  { key: "calendar", title: "Calendar", description: "Events, repeats, templates, reminders and calendar sync.", icon: "CalendarDays" },
  { key: "chores", title: "Chores, tasks & cleaning", description: "Chore charts, streaks, points, rewards and cleaning.", icon: "ClipboardCheck" },
  { key: "food", title: "Meals, recipes & grocery", description: "Shopping list, meal plans, recipes and the Family Pantry.", icon: "ShoppingBasket" },
  { key: "lists", title: "Lists", description: "To-do lists, packing lists and wishlists.", icon: "ListChecks" },
  { key: "communication", title: "Family communication", description: "Family Chat, announcements and contacts.", icon: "MessageCircle" },
  { key: "activities", title: "Sports, dance & activities", description: "Teams, practices, games, classes and work schedules.", icon: "Trophy" },
  { key: "home", title: "Home & household", description: "Important Info, maintenance, vehicles and the pool.", icon: "House" },
  { key: "memories", title: "Memories & photos", description: "Memories, albums, milestones, birthdays and anniversaries.", icon: "Images" },
  { key: "garden-pets", title: "Garden, farm & pets", description: "Garden plans, farm animals and pet care.", icon: "Sprout" },
  { key: "health", title: "Health & wellness", description: "Medical records, fitness, and your private health areas.", icon: "HeartPulse" },
  { key: "personal", title: "Journal & personal", description: "Journal, goals and the book library.", icon: "BookOpen" },
  { key: "spiritual", title: "Spiritual & faith", description: "Religion tabs, holidays, reading and devotions.", icon: "Moon" },
  { key: "trips", title: "Trips & plans", description: "Itineraries, reservations, trip photos and expenses.", icon: "Plane" },
  { key: "money", title: "Budget & reports", description: "Expenses, income, savings and reports.", icon: "Wallet" },
  { key: "notifications", title: "Notifications, privacy & sharing", description: "Notifications, phone alerts, privacy and printing.", icon: "Bell" },
  { key: "billing", title: "Subscription & billing", description: "Your plan, payment card and cancelling.", icon: "CreditCard" },
  { key: "troubleshooting", title: "Troubleshooting & support", description: "Sign-in problems, uploads, and contacting us.", icon: "LifeBuoy" },
];

export const ARTICLES: HelpArticle[] = [...BASICS, ...SETTINGS, ...EVERYDAY, ...LIFE];

/** Frequently asked questions, answered from how the app actually works. */
export const FAQS: HelpFaq[] = [
  { q: "Who can see what I add?", a: "Most things you add have a **Who can see this** choice: the whole family, selected people, parents, or only you. Journals and your personal health areas are private unless you share them.", slug: "privacy-overview" },
  { q: "Why can't I see a section my family uses?", a: "A parent chooses which sections each person can open. Ask a parent to check **Family → your name → Profile & access**. A section that's turned off for the whole family doesn't show for anyone.", slug: "cant-find-section" },
  { q: "How do I add my kids?", a: "Open **Family** and select **Add member**. Kids don't need an email; you can give them a login later.", slug: "add-family-member", audience: "parents" },
  { q: "Can kids have their own login?", a: "Yes. A parent opens the child on the **Family** page and gives them a login. You choose what they can open.", slug: "give-login", audience: "parents" },
  { q: "How do I make an event repeat every week?", a: "When adding or editing the event, choose how often it **Repeats**. Changing one repeat later lets you change just that day or the whole series.", slug: "recurring-events", modules: ["calendar"] },
  { q: "Can I see our calendar in Google, Outlook or Apple Calendar?", a: "Yes. Open **Calendar → Sync** and copy your private link into your other calendar app. You can also bring other calendars in by link.", slug: "calendar-sync", modules: ["calendar"] },
  { q: "Why didn't I get a phone notification?", a: "Turn on phone notifications on each device in **Notifications**. Alerts aren't sent between 9pm and 7am; they still appear in Notifications in the app.", slug: "push-notifications" },
  { q: "What happens to a chore streak if a day is missed?", a: "The streak starts again from the next time it's done. Days marked as skipped don't break a streak.", slug: "chore-streaks", modules: ["chores"] },
  { q: "How do I add groceries quickly?", a: "Use **Shopping** to add items, or add missing recipe ingredients from a recipe or meal plan. Things that run low in the Family Pantry can go straight to the list.", slug: "shopping-list", modules: ["shopping"] },
  { q: "Can I keep my own food, recipes or budget separate?", a: "Yes, if a parent turns on a private space for you. You'll then see **My Pantry**, **My Recipes**, **My Budget** and so on, which only you can see.", slug: "private-spaces" },
  { q: "Who can see an Important Info entry?", a: "Everyone can open Important Info, but each entry is only shown to the people chosen in its **Who can see this**.", slug: "important-info", modules: ["info"] },
  { q: "Can I upload videos?", a: "No. Albums and memories are for photos only." , slug: "albums", modules: ["photos"] },
  { q: "How do I download all our photos and information?", a: "The account owner can use **Account settings → Download your family's data** for a zip of every photo and a zip of everything saved.", slug: "download-data", audience: "owner" },
  { q: "How do I change or cancel our plan?", a: "Open **Account settings → Subscription**. Parents can see the plan; the account owner can change it, update the card or cancel.", slug: "subscription-overview", audience: "parents" },
  { q: "What's free, and what's Premium?", a: "The calendar, shopping list, chores, lists, Family Chat, contacts, Important Info and photo albums are free forever (with a few limits). Premium unlocks every other section, plus calendar sync, reminders and more. Sections with a small lock are Premium.", slug: "free-vs-premium" },
  { q: "Why does a section have a lock?", a: "It's a Premium section and your family is on the Free plan. You can still see everything you saved there; the account holder can upgrade to add and change things again.", slug: "free-vs-premium" },
  { q: "I forgot my password.", a: "On the sign-in page, select **Forgot password?** and follow the email we send.", slug: "cant-sign-in" },
  { q: "Can I use it like an app on my phone?", a: "Yes. Add it to your home screen from your browser. See the steps for iPhone and Android.", slug: "install-app" },
];

// ─── Who sees which help ──────────────────────────────────────────────────────

/** The parts of the signed-in viewer that help depends on (kept small so it's easy to test). */
export type HelpViewer = {
  isParent: boolean;
  isOwner: boolean;
  enabledModules: readonly string[];
  can: (m: Module) => boolean;
  privateFood?: boolean;
  privateFinance?: boolean;
  privateVehicles?: boolean;
  hasFaithPaths?: boolean;
};

const FOOD: Module[] = ["kitchen", "recipes", "meals", "shopping"];

/** Mirrors the menu: a section counts if the person can open it, or has their own private version of it. */
export function canOpen(v: HelpViewer, m: Module): boolean {
  if (m === "info") return v.enabledModules.includes("info");
  if (m === "witchcraft") return v.can(m) && (!!v.hasFaithPaths || v.isParent);
  if (v.can(m)) return true;
  if (FOOD.includes(m)) return !!v.privateFood;
  if (m === "budget") return !!v.privateFinance;
  if (m === "vehicles") return !!v.privateVehicles;
  return false;
}

function audienceOk(v: HelpViewer, a: HelpAudience | undefined) {
  if (!a || a === "everyone") return true;
  if (a === "parents") return v.isParent;
  return v.isOwner;
}

export function canRead(v: HelpViewer, item: { audience?: HelpAudience; modules?: Module[] }) {
  return audienceOk(v, item.audience) && (!item.modules?.length || item.modules.some((m) => canOpen(v, m)));
}

export type HelpFor = {
  categories: (HelpCategory & { count: number })[];
  articles: HelpArticle[];
  faqs: HelpFaq[];
};

/** Everything this person may read. Sections they can't open (and parent/owner-only help) are left out. */
export function helpFor(v: HelpViewer): HelpFor {
  const articles = ARTICLES.filter((a) => canRead(v, a));
  const categories = CATEGORIES.map((c) => ({ ...c, count: articles.filter((a) => a.category === c.key).length })).filter((c) => c.count > 0);
  const slugs = new Set(articles.map((a) => a.slug));
  const faqs = FAQS.filter((f) => canRead(v, f) && (!f.slug || slugs.has(f.slug)));
  return { categories, articles, faqs };
}

export const categoryOf = (key: string) => CATEGORIES.find((c) => c.key === key);
export const articleOf = (slug: string) => ARTICLES.find((a) => a.slug === slug);
export const articleHref = (a: Pick<HelpArticle, "category" | "slug">) => `/help/${a.category}/${a.slug}`;

// ─── Search ──────────────────────────────────────────────────────────────────

/** Plain text of an article (markup removed), for search and snippets. */
export const plain = (s: string) => s.replace(/\*\*/g, "");

const norm = (s: string) => plain(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Light stemming so "chores" finds "chore" and "reminders" finds "reminder". */
const stem = (w: string) => (w.length > 4 && w.endsWith("ies") ? w.slice(0, -3) + "y" : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);

const STOP = new Set(["a", "an", "the", "to", "do", "i", "my", "how", "can", "is", "of", "in", "on", "for", "and", "or", "what", "where", "it", "we", "our", "you", "your", "with"]);

export type SearchDoc = { slug: string; category: HelpCategoryKey; title: string; summary: string; title_n: string; keys_n: string; body_n: string };

/** Pre-normalised search index (built once on the server and sent to the search box). */
export function searchDocs(articles: HelpArticle[]): SearchDoc[] {
  return articles.map((a) => ({
    slug: a.slug,
    category: a.category,
    title: plain(a.title),
    summary: plain(a.summary),
    title_n: norm(a.title),
    keys_n: norm([...(a.keywords ?? []), a.summary].join(" ")),
    body_n: norm([...(a.steps ?? []), ...(a.sections ?? []).flatMap((s) => [s.heading, s.body ?? "", ...(s.steps ?? []), ...(s.bullets ?? [])])].join(" ")),
  }));
}

/** Ranks articles for a query: title words count most, then keywords/summary, then body text. */
export function searchHelp(docs: SearchDoc[], query: string, limit = 20): SearchDoc[] {
  const words = norm(query).split(" ").filter((w) => w && !STOP.has(w)).map(stem);
  if (!words.length) return [];
  const has = (text: string, w: string) => text.split(" ").some((t) => stem(t).startsWith(w));
  const phrase = norm(query);
  const scored = docs.map((d) => {
    let score = 0;
    let matched = 0;
    for (const w of words) {
      const s = (has(d.title_n, w) ? 10 : 0) + (has(d.keys_n, w) ? 5 : 0) + (has(d.body_n, w) ? 1 : 0);
      if (s) matched++;
      score += s;
    }
    if (phrase.length > 3 && d.title_n.includes(phrase)) score += 15;
    // Every word should match somewhere; partial matches rank below full ones.
    return { d, score: matched === words.length ? score : matched ? score / 4 : 0 };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.d);
}

/** Turns a Viewer from the data layer into a HelpViewer. */
export function toHelpViewer(viewer: {
  isParent: boolean;
  isOwner: boolean;
  family: { enabledModules: readonly string[] };
  member: { privateFood: boolean; privateFinance: boolean; privateVehicles: boolean };
  can: (m: Module) => boolean;
}, hasFaithPaths: boolean): HelpViewer {
  return {
    isParent: viewer.isParent,
    isOwner: viewer.isOwner,
    enabledModules: viewer.family.enabledModules,
    can: (m) => viewer.can(m),
    privateFood: viewer.member.privateFood,
    privateFinance: viewer.member.privateFinance,
    privateVehicles: viewer.member.privateVehicles,
    hasFaithPaths,
  };
}
