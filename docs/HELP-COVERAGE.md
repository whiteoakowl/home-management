# Help Center: coverage checklist

The customer Help Center lives at **/help** (signed-in only). It's reached from **Help & Support** in the left menu, the phone **More** menu, the profile menu (top right), and the **?** next to the title on key pages.

## How it's built

| Piece | Where |
| --- | --- |
| Content model (types) | `src/lib/help/types.ts` |
| Articles (plain data, `**bold**` for button names) | `src/lib/help/articles/{basics,settings,everyday,life}.ts` |
| Categories, FAQs, permission gating, search | `src/lib/help/index.ts` |
| Signed-in loader (`getHelp`) | `src/lib/help/server.ts` |
| Pages | `src/app/(app)/help/` (home, `[category]`, `[category]/[slug]`, `go/[slug]`, `not-found`, `error`) |
| Components | `src/components/help/` (search, FAQ accordions, rich text) |
| Contextual "?" | `PageHeader help="slug"` / `HelpButton` in `src/components/ui/display.tsx` |
| Tests | `tests/help.test.ts` |

**Adding an article:** add an object to one of the article files (slug, category, title, summary, steps or sections, optional `audience`, `modules`, `openIn`, `related`). The tests check slugs, categories, related links, FAQ links, "Open in app" routes and wording that must never appear.

## Who sees what

- **Signed out:** every /help URL redirects to sign-in.
- **Audience:** `parents` articles only show to parents; `owner` articles only to the account holder.
- **Sections:** an article tied to sections (`modules`) shows only if the person can open at least one of them, using the same rules as the menu (private food, budget and vehicle spaces count; Important Info shows whenever the family uses it; Spiritual needs a chosen religion, or a parent).
- Personal areas (Personal Health, Period Tracker, Food Journal, Mental Wellness, Privacy Center) are everyone's, so their help is always shown.
- An article you may not read returns "We couldn't find that help article", the same as a missing one, so it doesn't reveal what exists.
- A page's **?** for a parents-only article opens the topic (or Help home) instead.
- Search and FAQs only include articles the person may read (the search list is built on the server per person).
- No Main Admin, developer, database, payment-processor, API or internal-URL content (enforced by a test).

## Verification (Nov 2026)

| Check | Result |
| --- | --- |
| Signed-out /help and article URLs | 307 → /login |
| Parent (Sara): topics / articles | 20 / 96, all load |
| Kid (Serenity): topics / articles | 18 / 74; no Billing, no parents-only, no Budget or Medical |
| Kid opens parent/owner/other-section article by URL | Not-found page |
| Links inside every article (154 parent, 126 kid) | None broken |
| "Open in app" buttons | All go to real pages (test + browser) |
| Search "repeat event" | Top result "Repeating events" |
| Search with no match | Friendly no-results message with suggestions |
| FAQ accordions | Open and close (native, keyboard-friendly) |
| Calendar **?** | Opens "Creating a calendar event" |
| Menu entries | Sidebar, phone More menu, profile menu |
| Phone width 390px | No sideways scrolling on help home, topic, and article pages |
| Console errors | Only the expected 404s from the not-found checks |
| Unit tests | `tests/help.test.ts` (7 tests) |

## Contextual help ("?") pages

Calendar, Calendar sync, Event templates, Chores, Cleaning, Rewards, Lists, Grocery Shopping, Meals, Recipes, Pantry, Family, Family Chat, Contacts, Important Info, House, Home Maintenance, Vehicles, Pool, Memories, Birthdays & anniversaries, Photo albums, Plans, Budget, Reports, Garden, Farm, Pets, Medical, Fitness, Journal, Goals, Library, Sports, Dance, Work, Personal Health, Period Tracker, Food Journal, Mental Wellness, Privacy Center, Notifications, My settings, Account settings.

## Not covered on purpose

- The Main Admin area, platform pricing and comped families (staff only).
- Hosting, storage, payment and email setup (in `docs/LAUNCH.md`, not customer-facing).

## Article checklist

### Getting started (5)
- [x] Setting up your family for the first time — `/help/getting-started/first-time-setup` _(parents)_
- [x] Finding your way around — `/help/getting-started/navigating-the-app`
- [x] Customizing a dashboard — `/help/getting-started/dashboard-customize`
- [x] Installing the app on your phone — `/help/getting-started/install-app`
- [x] Searching and adding things quickly — `/help/getting-started/search-and-quick-add`

### Account & profile (14)
- [x] Changing your name, color or birthday — `/help/account/edit-profile`
- [x] Adding or changing a profile photo — `/help/account/profile-photo`
- [x] My settings: password, email and app colors — `/help/account/my-settings` → opens `/account`
- [x] Changing your password — `/help/account/change-password` → opens `/account`
- [x] Changing the email you sign in with — `/help/account/change-email` → opens `/account`
- [x] Signing out — `/help/account/sign-out`
- [x] Where are the family's settings? (Account settings) — `/help/account/account-settings` _(parents)_ → opens `/settings`
- [x] Turning sections on or off — `/help/account/turn-sections-on-off` _(account owner)_ → opens `/settings`
- [x] Adding and editing categories (and calendar colors) — `/help/account/categories` _(parents)_ → opens `/settings`
- [x] Changing the app's colors — `/help/account/family-colors`
- [x] Automatic reminders and jobs (Automations) — `/help/account/automations` _(parents)_ → opens `/settings`
- [x] Downloading all your photos and saved information — `/help/account/download-data` _(account owner)_ → opens `/settings`
- [x] Deleting the family account — `/help/account/delete-account` _(account owner)_ → opens `/settings`
- [x] Photo and file storage — `/help/account/storage` _(parents)_

### Family & members (7)
- [x] Adding a family member (like your child) — `/help/family/add-family-member` _(parents)_ → opens `/family`
- [x] Changing what someone can see and do (permissions) — `/help/family/permissions` _(parents)_ → opens `/family`
- [x] Giving someone a login, or resetting their password — `/help/family/give-login` _(parents)_
- [x] Each person's home page — `/help/family/member-home`
- [x] Removing someone from the family — `/help/family/remove-member` _(parents)_
- [x] Choosing what the kids call parents — `/help/family/kid-names` _(parents)_ → opens `/settings`
- [x] Private spaces for kids and teens — `/help/family/private-spaces` _(parents)_

### Calendar (10)
- [x] Creating a calendar event — `/help/calendar/create-event` → opens `/calendar`
- [x] Editing or deleting an event — `/help/calendar/edit-event`
- [x] Repeating events — `/help/calendar/recurring-events`
- [x] Event templates (soccer practice in one tap) — `/help/calendar/event-templates` → opens `/calendar/templates`
- [x] Event reminders — `/help/calendar/event-reminders`
- [x] Month, week, day and list views — `/help/calendar/calendar-views`
- [x] Changing calendar colors — `/help/calendar/calendar-colors`
- [x] Printing or saving the calendar as a PDF — `/help/calendar/print-calendar`
- [x] Syncing with Google, Outlook or Apple Calendar — `/help/calendar/calendar-sync` → opens `/calendar/sync`
- [x] What the calendar symbols mean — `/help/calendar/calendar-symbols`

### Chores, tasks & cleaning (6)
- [x] Creating and assigning a chore — `/help/chores/create-chore` → opens `/house/chores`
- [x] Checking off, skipping or reassigning a chore — `/help/chores/complete-chore`
- [x] Chore streaks (🔥) — `/help/chores/chore-streaks`
- [x] Points and rewards — `/help/chores/points-rewards` → opens `/house/rewards`
- [x] One-time tasks — `/help/chores/tasks` → opens `/house/tasks`
- [x] Cleaning schedules and room scores — `/help/chores/cleaning` → opens `/house/cleaning`

### Meals, recipes & grocery (6)
- [x] Using the grocery shopping list — `/help/food/shopping-list` → opens `/shopping`
- [x] Planning the week's meals — `/help/food/meal-plan` → opens `/meals`
- [x] Adding, importing and cooking recipes — `/help/food/recipes` → opens `/recipes`
- [x] Tracking the pantry, fridge and freezer — `/help/food/pantry` → opens `/kitchen`
- [x] Adding groceries from a receipt — `/help/food/receipt-import` → opens `/kitchen/receipt`
- [x] My own pantry, recipes and shopping list — `/help/food/private-food-space`

### Lists (2)
- [x] Making and sharing a list — `/help/lists/lists` → opens `/lists`
- [x] Gift wishlists — `/help/lists/wishlists` → opens `/lists/wishlists`

### Family communication (3)
- [x] Using Family Chat — `/help/communication/family-chat` → opens `/messages`
- [x] Family announcements — `/help/communication/announcements` _(parents)_
- [x] The family address book (Contacts) — `/help/communication/contacts` → opens `/contacts`

### Sports, dance & activities (3)
- [x] Sports: teams, practices, games and stats — `/help/activities/sports` → opens `/sports`
- [x] Dance: classes, performances and pointe shoes — `/help/activities/dance` → opens `/dance`
- [x] Work schedules — `/help/activities/work-schedules` → opens `/work`

### Home & household (6)
- [x] Important Info (your family binder) — `/help/home/important-info` → opens `/house/info`
- [x] Printing a babysitter sheet — `/help/home/babysitter-sheet` → opens `/house/info/sitter`
- [x] Home maintenance, repairs and projects — `/help/home/home-maintenance` → opens `/maintenance`
- [x] The House overview and rooms — `/help/home/house-overview` → opens `/house`
- [x] Vehicles — `/help/home/vehicles` → opens `/vehicles`
- [x] Pool or spa — `/help/home/pool` → opens `/pool`

### Memories & photos (3)
- [x] Adding memories and milestones — `/help/memories/memories` → opens `/memories`
- [x] Photo albums — `/help/memories/albums` → opens `/photos`
- [x] Birthdays and anniversaries — `/help/memories/special-dates` → opens `/memories/dates`

### Garden, farm & pets (3)
- [x] Garden plans, plantings and seeds — `/help/garden-pets/garden` → opens `/garden`
- [x] Farm animals, feed and production — `/help/garden-pets/farm` → opens `/farm`
- [x] Pets — `/help/garden-pets/pets` → opens `/pets`

### Health & wellness (6)
- [x] Personal Health and the Privacy Center — `/help/health/personal-health` → opens `/health`
- [x] Period Tracker — `/help/health/period-tracker` → opens `/health/period`
- [x] Food Journal — `/help/health/food-journal` → opens `/health/food`
- [x] Mental Wellness — `/help/health/mental-wellness` → opens `/wellness`
- [x] Fitness: workouts, plans and measurements — `/help/health/fitness` → opens `/fitness`
- [x] Family Medical & Health records — `/help/health/medical` → opens `/medical`

### Journal & personal (3)
- [x] Journal — `/help/personal/journal` → opens `/journal`
- [x] Goals and savings — `/help/personal/goals` → opens `/goals`
- [x] Book Library — `/help/personal/library` → opens `/library`

### Spiritual & faith (1)
- [x] Spiritual & faith tabs — `/help/spiritual/spiritual` → opens `/spiritual`

### Trips & plans (1)
- [x] Planning a trip (itinerary, reservations, photos, expenses) — `/help/trips/trips` → opens `/plans`

### Budget & reports (2)
- [x] Reports — `/help/money/reports` → opens `/reports`
- [x] Budget: expenses, income, bills and savings — `/help/money/budget` → opens `/budget`

### Notifications, privacy & sharing (6)
- [x] Choosing which notifications you get — `/help/notifications/notifications-preferences` → opens `/notifications`
- [x] Turning on phone notifications (push) — `/help/notifications/push-notifications` → opens `/notifications`
- [x] Privacy: who can see what — `/help/notifications/privacy-overview`
- [x] Sharing something with one family member — `/help/notifications/share-with-someone`
- [x] Editing or deleting something — `/help/notifications/edit-or-delete-anything`
- [x] Printing or saving as PDF — `/help/notifications/print`

### Subscription & billing (4)
- [x] Your plan, free trial and renewal — `/help/billing/subscription-overview` _(parents)_ → opens `/settings/billing`
- [x] Switching between monthly and yearly — `/help/billing/change-plan` _(account owner)_ → opens `/settings/billing`
- [x] Updating your payment card — `/help/billing/update-card` _(account owner)_ → opens `/settings/billing`
- [x] Cancelling (or resuming) your subscription — `/help/billing/cancel-subscription` _(account owner)_ → opens `/settings/billing`

### Troubleshooting & support (5)
- [x] I can't sign in — `/help/troubleshooting/cant-sign-in`
- [x] A photo won't upload — `/help/troubleshooting/photo-upload-problems`
- [x] Something isn't working or looks wrong — `/help/troubleshooting/something-not-working`
- [x] I can't see a section or a button — `/help/troubleshooting/cant-find-section`
- [x] Contacting support or suggesting a feature — `/help/troubleshooting/contact-support` → opens `/feedback`
### FAQs

- [x] Who can see what I add?
- [x] Why can't I see a section my family uses?
- [x] How do I add my kids? _(parents)_
- [x] Can kids have their own login? _(parents)_
- [x] How do I make an event repeat every week?
- [x] Can I see our calendar in Google, Outlook or Apple Calendar?
- [x] Why didn't I get a phone notification?
- [x] What happens to a chore streak if a day is missed?
- [x] How do I add groceries quickly?
- [x] Can I keep my own food, recipes or budget separate?
- [x] Who can see an Important Info entry?
- [x] Can I upload videos?
- [x] How do I download all our photos and information? _(account owner)_
- [x] How do I change or cancel our plan? _(parents)_
- [x] I forgot my password.
- [x] Can I use it like an app on my phone?
