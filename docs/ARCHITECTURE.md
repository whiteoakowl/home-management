# Vanderbilt Family — Architecture

> **Vanderbilt Family**. One cohesive app for running a family household: chores, calendar,
> kitchen, garden, farm, budget, goals, fitness and journal, all connected.

This document is the source of truth for how the app is structured. Every phase builds on it, and
nothing gets built as a throwaway feature that will need replacing later.

---

## 1. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16 (App Router)**, React 19, TypeScript | One codebase for UI and server logic; Server Components + Server Actions keep data access on the server. |
| Styling | **Tailwind CSS v4** + a small in-house component library (`src/components/ui`) | Design tokens live in CSS variables; components enforce consistency. |
| Database | **PostgreSQL** | Relational data with real foreign keys, JSONB for flexible bits (checklists, layouts, widget config). |
| ORM / migrations | **Drizzle ORM** + drizzle-kit | Type-safe SQL, pure JS (no native engines), schema-as-code. |
| Auth | Custom session auth: bcrypt password hashes + opaque random session tokens (SHA-256 hashed at rest) in an httpOnly cookie | No third-party dependency; sessions are revocable server-side. Can be swapped for an auth provider later without touching the DAL contract. |
| Validation | **Zod** | Shared server-side validation for every Server Action. |
| Icons | **lucide-react** | One consistent icon family. |

`cacheComponents` is **disabled**: virtually every page is per-family and per-user, so pages render
per request. Data access is still centralised in the DAL (§6), so caching can be layered in later.

---

## 2. Information architecture & navigation

The app is organised into **areas**, each a top-level nav item. Areas are grouped so the nav never
feels like 16 equal-weight tools:

| Group | Areas |
|---|---|
| **Today** | Home (dashboard), Calendar |
| **Household** | Family, House (cleaning, chores, tasks, info), Lists, Home Maintenance |
| **Care** | Medical, Pets |
| **Kitchen** | Kitchen (pantry/fridge/freezer/supplies), Meals, Recipes |
| **Land** | Garden, Farm |
| **Personal** | Journal, Goals, Fitness |
| **Spirit** | Spiritual |
| **Money** | Budget |
| **Admin** | Reports, Settings |

* **Desktop (≥1024px):** persistent left sidebar with grouped icon + label nav; top bar with the
  member switcher, notifications, and the universal **+ Add** button.
* Medical, Pets, Spiritual and Home Maintenance show their **submenu** under the active item in the
  sidebar, and as scrollable section tabs on every one of their pages (all screen sizes).
* **Tablet (640–1023px):** collapsible sidebar (icon rail).
* **Mobile (<640px):** bottom tab bar with **Home · Calendar · [+] · Lists · More**. "More" opens a
  full-screen sheet with every area. The centre **+** opens Quick Add.

Families can **turn whole areas off** (e.g. no farm), which hides them everywhere: nav, dashboard
widgets, quick-add, and search. This is the main way progressive disclosure works.

### Page hierarchy

```
/login, /signup                      public
/onboarding                          first-time setup wizard (10 skippable steps)
/                                    dashboard ("What do I need to do today?")
/family                              members list, roles, invites
/family/[memberId]                   member portal ("Serenity's Home")
/family/[memberId]/manage            profile, permissions, login, removal (parents only)
/calendar                            day / week / month / agenda
/house                               house overview
  /house/cleaning, /house/chores, /house/maintenance, /house/projects, /house/documents
/lists, /lists/[id]
/kitchen                             inventory overview + expiration alerts
  /kitchen/[location]                pantry | fridge | freezer | supplies
  /kitchen/scan                      barcode scanner
/meals                               weekly meal planner
/recipes, /recipes/[id], /recipes/collections
/shopping, /shopping/[id]
/garden, /garden/plants, /garden/plants/[id], /garden/plans/[id] (blueprint), /garden/log
/farm, /farm/animals/[id], /farm/production, /farm/plans/[id] (blueprint)
/journal, /journal/[id]
/goals, /goals/[id]
/fitness, /fitness/plans/[id], /fitness/food
/budget, /budget/income, /budget/expenses
/reports/[kind]
/search?q=
/notifications
/settings                            family profile, colours, categories, modules, dashboard
```

---

## 3. User roles & permissions

### Identity model

* **User**: a login identity (email + password). Never holds household data directly.
* **Family**: the tenant. Every household record carries `family_id`.
* **Family member**: a person in the household. A member *may* be linked to a user (has a login)
  or not (a young child who only appears on chore charts). Parents can grant a login later.

### Roles

| Role | Meaning |
|---|---|
| `parent` | Full admin of the family. Can manage members, permissions, settings and all records. The family creator is a parent and the **owner** (`families.owner_member_id`); the owner can't be demoted or removed. |
| `member` | Sees their own portal plus whatever parents grant. |

### Permission layers

Permissions are evaluated in this order (all enforced on the server in the DAL):

1. **Tenant isolation.** A request can only touch rows whose `family_id` equals the signed-in
   member's family. No exceptions.
2. **Module access.** `member_permissions(member_id, module, level)` with `level ∈ none | view | add | edit`.
   Parents implicitly have `edit` everywhere. New members get sensible defaults (§3.1). `add` (create
   new records, change only what you created) is offered for the Family Pantry modules only
   (`ADD_LEVEL_MODULES` in `src/lib/permissions.ts`); elsewhere a stored `add` counts as `view`.
3. **Record visibility.** Shareable records (events, lists, journal entries, documents, goals,
   household info) have a `visibility` column:
   * `family`: everyone with module `view`.
   * `selected`: the creator and the members listed in `record_access` (parents only if listed).
   * `parents`: the creator and parents. "Parents & me" in the picker.
   * `private`: only the creator. "Only me" in the picker.
   Parents get **no automatic access**: they see a member's record only when the creator picks an
   option that includes them. Medical uses the same values via `medicalVisible`, where the patient and
   whoever added the record always see it: `parents` = "Patient & parents" (the default), `private` =
   "Only the patient". Medical reminders go to parents only for `family` / `parents` records.
   `record_access(entity_type, entity_id, member_id, can_edit)` holds the explicit list. This is the
   "Visible to ☑ Mom ☑ Dad ☑ Serenity ☐ Jack" control.
4. **Assignment.** Members can always see and complete items assigned to them (chores, tasks,
   checklist items), even if they only have `view` on the module.

Records marked `private` ("Only me") are visible **only to their author**, parents included.

**Access levels in plain words** (Family → Profile & access): *No access* hides the area; *View only*
lets them look; *Add own* (Family Pantry areas) lets them add things and change only their own; *Add &
edit* lets them create (lists, events, goals…) and change what they can see. Members need *Add & edit*
on Lists / Calendar to make their own lists and events.

**Personal shopping items** (`list_items.personal_for_member_id`). Anyone who can see a family shopping
list can add personal items for themselves (parents can add them for anyone). Only parents, the person
it's for and whoever added it see the item; it shows as "For Serenity" in a "Personal items" section, and
is left out of Buy again, activity and everyone else's counts, previews and search.

**Personal library** (`books.owner_member_id`). The Book Library has a Family Library / My Library switch
(remembered in a cookie). Books in My Library are visible only to their owner, parents included; anyone
with library `view` can keep one. Personal books never appear in the activity feed.

**Fitness privacy.** Everyone sees their own fitness and food journal, and nobody else's unless that
person turns on *Share with parents* (`family_members.share_fitness`): then parents can view it, not
edit it. Members without a login (young kids) can't choose, so parents see and manage theirs. The same rule (`src/lib/fitness.ts`) covers
the fitness pages, server actions, portal widget, calendar workouts layer, search, reports and the
activity feed.

**Goals privacy** (`src/lib/goals.ts`). The Goals page's *Family* tab shows family-wide goals plus other
members' personal and fitness goals; *My personal*, *My savings* and *My fitness* show only the viewer's
own. A member's own savings goals are private to them, parents included (`notOthersSavings`): hidden from
lists, goal pages, dashboards and profiles, search, reports and the budget's goal picker.

**Family Pantry spaces** (`src/lib/food-space.ts`). Pantry items, recipes, recipe collections, meal
plans and shopping lists have `owner_member_id`: `NULL` = the family's (governed by module access),
set = that member's **private food space** (My Pantry / My Recipes / My Meal Plans / My Shopping
List). Parents enable a private space per member (`family_members.private_food`). Private rows are
visible only to their owner; parents may open them read-only only when that member turns on *Share with
parents* (`family_members.share_food_with_parents`, off by default, the member's own choice). Pages take `?space=mine` (or a member id for
parents); every shared view (dashboards, search for other people, calendar, reports, automations,
low-stock, put-away, craft/celebration links) filters to the family space.

### 3.1 Default member permissions

| Module | Default for `member` |
|---|---|
| calendar, chores, lists, recipes, meals, journal, goals, fitness | `edit` (scoped by visibility/assignment) |
| house, cleaning, projects (House Projects), info (Important Info), kitchen, garden, farm, shopping | `view` |
| budget, reports, settings | `none` |

House is split into separate permission areas: **Cleaning** (`/house/cleaning`), **Chores**
(`/house/chores`), **House Projects** (`/maintenance/projects`) and **Important Info** (`/house/info`),
alongside **Maintenance**. Migration 0016 gave everyone the access they already had (House → Cleaning and
Important Info, Maintenance → House Projects).

**Changing things.** Parents can change anything they can see. Members, with *Add own* or *Add & edit*,
can add things and change only what they added (`canChangeItem` / `assertCanChange` in `src/lib/dal.ts`;
`canChange` for food records; list items by `added_by_member_id`). The family activity feed only names
items shared with the whole family.

### 3.2 Personal privacy (Privacy Center)

Personal areas belong to one person and are **private by default**: Period Tracker, Food Journal, Mental
Wellness and Fitness. `privacy_settings(member_id, category, audience, member_ids, options)` holds each
person's choice per area: `private` · `parents` · `selected` (`src/lib/privacy.ts`, page `/privacy`).
Journal, Goals and Medical keep per-entry visibility; the Privacy Center sets the default for new entries.
`personalAccess()` decides access:

1. yourself, always;
2. **managed**: parents, for a family member without a login;
3. **oversight**: parents, for a minor (under 18 or no birthday) in the areas parents turned on
   (`family_members.parent_access`, Family → Manage). The member sees this in their Privacy Center;
4. **shared**: the parents / selected people the person chose.

Only the owner (or parents for a member without a login) can change personal records
(`canManagePersonal`). Nothing personal appears on the family dashboard. Period days appear on the
calendar only if the person turns on "Show on the calendar" (layer `cycle`, owner + their audience).

### 3.3 Personal areas

Parents can **remove** the Period Tracker and/or Mental Wellness from any family member's profile
(Family → Manage → "Personal areas on this profile"; `family_members.hidden_areas`). A removed area
disappears from that person's menu, Personal Health page, profile, Privacy Center, calendar, search and
reminders, and from anyone they had shared it with. Records are kept and come back when it's turned on.

* **Period Tracker** (`/health/period`, `period_days`, `src/lib/cycle.ts`): one row per recorded day (flow,
  symptoms, feelings, intensity, note). Periods/cycles are derived from light/medium/heavy flow days.
  Statistics and estimates come from the person's records (or typical lengths until two periods are
  recorded) and are always labelled as estimates. **Simple tracking is the default**; ovulation
  estimates ("ovulation window") show only when `personal_health_profiles.show_ovulation` is on. For a
  minor only parents can turn it on (Family → Manage); adults choose for themselves.
* **Food Journal** (`/health/food`, `food_journal_entries`): date, time, meal (breakfast … beverage,
  other), food, portion, hunger, fullness, feelings, notes, photo; day / week / month / timeline views and
  search. Neutral wording only: no calories, targets or good/bad foods. `/fitness/food` redirects here.
* **Mental Wellness** (`/wellness`): daily check-ins (`wellness_check_ins`: mood, feelings, intensity,
  self-care, note, `shared`), wellness journal (`journal_entries` with `book = 'wellness'` and `details`
  JSON: gratitude, accomplishments, challenges, self-care, prompt; kept out of the family Journal), gentle
  goals (`wellness_goals`, progress counted from activity), daily quotes (`src/lib/quotes.ts`, original or
  public-domain; favourites + notes in `quote_favorites`), mood history (week/month/year), reminders
  (`personal_health_profiles.reminders`, daily automation, kind `wellness_reminder`). Sharing is per item
  (today's mood, an entry, a goal) to the person's Mental Wellness audience. If text suggests someone may
  be in danger (`needsSupport`), a support panel shows 911 / 988 / Crisis Text Line and a "Let my parents
  know I'd like to talk" button that notifies parents without sharing what was written. It never
  diagnoses.

### 3.4 Imports

* **Grocery receipts** (`/kitchen/receipt`, `/kitchen/receipts`): the photo is read **on the device**
  with tesseract.js (assets self-hosted in `public/ocr`, copied by `scripts/copy-ocr-assets.mjs`), parsed
  by `src/lib/receipt.ts`, then reviewed item by item. Only reviewed, selected items are added to the
  Family Pantry or My Pantry; items already in the pantry are offered "Add to existing inventory".
  Receipts can be saved (`grocery_receipts`, `grocery_receipt_items`) and recorded as a household expense.
* **Word recipes** (`/recipes/import-word`): `src/lib/recipe-doc.ts` reads the .docx (ZIP) on the server,
  splits pages at page/section breaks (Word's rendered breaks if there are none) and reads each page as
  one recipe; fields not in the document are left blank. Review, rename, categorise, tag and add photos,
  then save to Family Recipes or My Private Recipes.

### 3.5 Colours

Members have 26 colours (`src/lib/colors.ts`), used on avatars, the calendar and charts and chosen by
parents. Each person can also pick their own **app colour theme** (`family_members.app_theme`, Account →
My settings): it regenerates the `--color-primary-*` tokens for their app only (`src/lib/theme.ts`, with
contrast checks) and never changes member colours.

---

## 4. Database schema

Conventions: UUID primary keys, `family_id` on every tenant table (indexed, `ON DELETE CASCADE`),
`created_at` / `updated_at` timestamps, `created_by_member_id` where authorship matters. Money is
stored in **integer cents**. Quantities are `numeric`. Flexible, UI-owned structures (checklists
snapshots, blueprint geometry, widget layouts) are JSONB.

Full definitions live in `src/db/schema/*.ts`. Entity map by domain:

### Core (`core.ts`)
* `users`: id, email (unique), password_hash, name
* `sessions`: id, user_id, token_hash, expires_at
* `families`: id, name, image_file_id, timezone, location (lat/lng for weather), owner_member_id,
  onboarding_step, onboarding_completed_at, enabled_modules (text[]), theme (JSONB)
* `family_members`: id, family_id, user_id (nullable, unique per family), display_name, role,
  color, avatar_file_id, birthday, is_active
* `member_permissions`: (member_id, module) PK, level
* `record_access`: entity_type, entity_id, member_id, can_edit
* `categories`: family-wide custom categories for any domain
  (`domain ∈ chore | calendar | budget | list | garden | farm | recipe | household | inventory`),
  name, color, icon, sort_order
* `files`: uploaded images/documents (storage key, mime, size, width/height, thumbnail key)
* `dashboard_layouts`: per member: ordered widget list with visibility & size
* `announcements`: household announcements (with visibility)
* `activity_log`: family feed ("Serenity completed Clean Kitchen")
* `notifications` + `notification_preferences`

### Household (`household.ts`)
* `rooms`: named areas of the house
* `recurrence_rules`: a shared recurrence definition (freq, interval, by_weekday, by_month_day,
  month_of_year, until, count) reused by chores, cleaning, events, maintenance, workouts, expenses
* `chores`: the template (title, instructions, room, category, priority, est_minutes,
  default_assignee, recurrence_rule_id, kind `chore | cleaning | maintenance | task`,
  cleaning_cadence `daily … annual | custom`)
* `chore_checklist_items`: template checklist items with optional per-item assignee
* `chore_occurrences`: concrete instances generated from templates (due_date, assignee, status
  `pending | done | skipped | missed`, completed_at, completed_by)
* `chore_occurrence_items`: checklist state per occurrence
* `home_projects`, `home_documents`, `household_info` (important info, visibility-aware)

Cleaning, chores, maintenance and one-off tasks share one engine (`chores` + `chore_occurrences`).
That gives one completion history, one "My Chores" view, one reporting pipeline.

### Calendar (`calendar.ts`)
* `calendar_events`: title, description, location, starts_at, ends_at, all_day, category_id,
  color, recurrence_rule_id, reminder_minutes, notes, visibility, source (`manual | chore |
  workout | meal | garden | farm`) + source_id for auto-generated entries
* `event_attendees`: (event_id, member_id)
* `event_attachments`: (event_id, file_id)
* Visibility per event uses `record_access`.
* Views (`components/calendar/views.tsx`): Month shows named colour bars (tooltip = full details),
  Week/Day time grid with times and members, Day adds a details list, and `?view=list` is a
  chronological list grouped by date with filters in the URL (`range` today|week|month|upcoming|custom
  + `from`/`to`, `member`, `category`, `type`, `vis`, `color`, `q`). Items link to the existing event
  page; `?view=agenda` still works and opens the List view.

### Lists (`lists.ts`)
* `lists`: title, kind `checklist | bullet | numbered | todo | shopping`, category_id, visibility,
  store (shopping)
* `list_items`: text, position, checked, due_date, priority, assignee, recurrence_rule_id,
  quantity/unit/shopping_category/source (`manual | recipe | low_stock | meal_plan`), source_id

Shopping lists are lists with `kind = 'shopping'`: one list engine.

### Kitchen (`kitchen.ts`)
* `products`: barcode-keyed product catalogue (shared cache of lookups, per family)
* `inventory_items`: name, product_id, quantity, unit, location `pantry | fridge | freezer |
  supplies | farm | garden`, category, purchased_on, expires_on, low_stock_threshold, notes
* `inventory_events`: added / used / discarded / donated / replaced / adjusted (history and waste
  reporting)

### Recipes & meals (`meals.ts`)
* `recipes`, `recipe_ingredients` (normalised name, quantity, unit), `recipe_collections`,
  `recipe_collection_items`, `recipe_ratings` (per member)
* `meal_plan_entries`: date, slot `breakfast | lunch | dinner | snack`, recipe_id or free text,
  servings
* `food_journal_entries`: member, date, meal slot, food, notes, image, meal_plan_entry_id link

### Garden (`garden.ts`)
* `plants`: the plant database (global seed rows have `family_id NULL`; families add custom ones)
  with all horticultural fields
* `seed_inventory`
* `garden_plans`: name, year, canvas size, JSONB layout (beds, rows, paths, structures, irrigation,
  fences, zones with x/y/w/h/rotation)
* `garden_plantings`: plant_id, plan_id, bed_key, quantity, planted_on, status
* `garden_logs`: planting_id, kind `sown | germinated | transplanted | watered | fertilized |
  pest | disease | harvest | seed_saved | note`, quantity, unit, notes, photo

### Farm (`farm.ts`)
* `animals`: name, species, breed, sex, birth_date, acquired_on, image, status, group/flock name
* `animal_health_records`, `feed_logs`
* `production_logs`: animal_id or group, product `eggs | milk | meat | honey | wool | produce`,
  quantity, unit, date. Can push into kitchen inventory (`inventory_events.source`)
* `farm_plans`: same JSONB blueprint format as garden plans

### Personal (`personal.ts`)
* `journal_entries` (+ `journal_entry_members`, `journal_entry_files`): mood, tags, visibility
* `goals`: owner (member or family), kind `savings | fitness | personal | family`, horizon
  `6m | 1y | 5y | 10y | 20y`, target/current amounts, target_date, monthly_contribution
* `goal_milestones`, `goal_contributions` (savings contributions can link to expenses)
* `fitness_plans`, `workouts` (scheduled day + recurrence), `workout_exercises`
* `workout_logs`, `workout_log_sets`, `body_metrics` (weight etc.), `personal_records`

### Finance (`finance.ts`)
* `budget_categories` → stored in `categories` with `domain = 'budget'`, plus `budget_limits`
  (monthly amount per category)
* `income_sources`: name, amount_cents, frequency, member
* `transactions`: kind `expense | income | transfer_to_savings`, amount_cents, category, date,
  recurrence_rule_id, goal_id (savings), shopping_list_id link, notes

### Medical (`medical.ts`), add-on
* `medical_profiles` (one per member), `allergies` (type, severity, ingredient `triggers[]`, file),
  `food_restrictions` (kind, `foods[]`), `medical_conditions`, `medications` (refills), `medical_documents`.
* Every row: `member_id`, `visibility` (default **private** = patient + parents), `created_by_member_id`;
  sharing via `record_access(entity_type='medical')`. Attachments are served only to people who may
  see the record (`canReadMedicalFile` in `/api/files/[id]`).
* Appointments are `calendar_events` with `source='medical'`, `source_id = patient`.

### Pets (`pets.ts`), add-on
* `pets`, `pet_photos`, `pet_medical_records`, `pet_preventatives` (interval, next due, assignee),
  `pet_care_notes`, `pet_supplies` (→ `inventory_items` with `location='pets'`).
* Care schedules are `chores.pet_id`; memories are `journal_entries` with `book='pet'`, `linked_id = pet`.

### Book Library (`library.ts`, `isbn.ts`, routes under `/library`), module `library`
* `books` (title, author, co-author, ISBN-13, publisher, published date, cover file, description,
  genre, pages, edition, format, acquired/purchase/price, rating, notes, favorite, reading status
  `want_to_read | not_started | reading | paused | completed | abandoned`, reader, started/finished,
  current page, reading notes, visibility via `record_access` entity `book`).
* Categories reuse `categories` (domain `book`); `book_categories` links books to several.
* Scanning: `components/scan/use-barcode-camera.ts` (BarcodeDetector, ZXing fallback; shared with the
  kitchen). `lookupIsbn` asks Open Library + Google Books (`GOOGLE_BOOKS_API_KEY` optional) and merges
  the answers; nothing is saved until the confirm form is submitted. Covers are copied into the
  family's storage on save.
* Dashboard cards are customizable per member (`section_layouts`, section `library`); a "Reading"
  widget is on the home dashboard; books appear in global search and quick add.

### Spiritual (`craft.ts`, routes under `/spiritual`; module id stays `witchcraft`), add-on
* Old `/witchcraft/*` links redirect (next.config.ts). The section renders inside `.theme-celestial`
  (globals.css), which re-maps the design tokens to a dark celestial palette for every shared component.
* The dashboard's cards are customizable per member via `section_layouts` (`SECTION_WIDGETS` in
  `src/lib/widgets.ts`, shared with the Book Library).
* `craft_items` (kind spell | ritual | crystal | herb | tool | wellness; `family_id NULL` = built-in
  reference from `src/db/craft-data.ts`; kind-specific `fields` JSONB; `plant_id` → garden plant),
  `craft_collection`, `craft_item_supplies` (→ inventory, `location='craft'`), `sabbat_settings`
  (date overrides & notes), `celebrations` (+ `celebration_links` to recipes / rituals, calendar event,
  shopping list, budget via `transactions.celebration_id`).
* Grimoire = `journal_entries` with `book='grimoire'` (excluded from the family journal).
* Astronomy (`src/lib/astro.ts`): Meeus ch. 49 lunar phases, ch. 47 lunar longitude (moon sign),
  ch. 27 equinoxes/solstices; `src/lib/sabbats.ts` builds the Wheel of the Year (hemisphere-aware).

### Home maintenance (`maintenance.ts` + `household.ts`), add-on
* `rooms` gained `kind` (room | area | system), description, notes, image.
* Maintenance schedules are `chores(kind='maintenance')` with `estimated_cost_cents`;
  `chore_occurrences.actual_cost_cents` records what each one cost.
* `home_repairs` (status, cost, contractor, warranty), `home_photos` (before / after / receipt /
  inspiration / progress / plan for repairs, projects and rooms).
* `home_projects` (status idea → planning → budgeting → ready → in_progress → on_hold → completed)
  with `project_stages`, `project_materials`, tasks (`chores.project_id`), expenses
  (`transactions.project_id`), documents (`home_documents.project_id`) and a materials shopping list.
* `home_documents` gained `doc_type`, room, project, appliance; House's old project/document pages
  redirect here (one set of records).

### Everyday extras (`extras.ts` + columns), phase 9
* **Points & rewards**: `chores.points`; `chore_occurrences.points_awarded` is captured at completion
  (credited to whoever completed it). `rewards` (cost, optional cash value, optional members),
  `reward_redemptions` (requested → approved/denied; requested points are held), `point_adjustments`
  (parent bonuses/deductions). Approved cash rewards become an "Allowance" budget expense.
* **Rotation**: `chores.rotation_member_ids`; the materialiser assigns the nth occurrence (counting every
  generated date) to `rotation[n % size]`, so regenerating never reshuffles past turns.
* **Cleanliness meters** (`src/lib/cleanliness.ts`, pure): condition = 1 − days since last done ÷ typical
  interval; rooms score the average. "Clean now" completes the due occurrence or logs an extra one.
* **Recipe import** (`src/lib/recipe-import.ts`, pure): schema.org Recipe JSON-LD (incl. `@graph`,
  HowToSection, ISO-8601 durations) and a pasted-text parser; pages are fetched with `safeFetch`
  (`src/lib/safe-fetch.ts`: http(s) only, DNS-checked against private/loopback ranges on every redirect,
  timeout and size cap). Cook mode detects timers in steps (`timersIn`) and holds a screen wake lock.
* **Shopping**: `list_items.price_cents` (remembered per item name), list totals, "buy again" from the
  family's shopping history; a checked-item total pre-fills the shopping-trip expense.
* **Pantry cooking**: `/kitchen/cook` ranks recipes by missing ingredients, then by use of items expiring
  within 5 days. `activeInventory` only counts food locations (pet food and craft/home supplies never
  satisfy a recipe).
* **Home inventory & providers**: `home_items` (room, value, serial, photo, receipt, warranty) with a
  printable insurance report; `vendors` (trade, contact, rating) linked from `home_repairs.vendor_id`;
  `/maintenance/manual` assembles a printable household manual from info, providers, systems,
  appliances & manuals, paint colors, upkeep and pet care notes.

### Key relationships (the "interconnected" principle)

```
recipes ─< recipe_ingredients ──compare──> inventory_items ──missing──> list_items (shopping)
meal_plan_entries >─ recipes ;  food_journal_entries >─ meal_plan_entries
garden_logs(harvest) ──creates──> inventory_events ──> inventory_items
production_logs(eggs/milk) ──creates──> inventory_events ──> inventory_items
chores ─< chore_occurrences >─ family_members ──> notifications, activity_log, calendar
workouts(schedule) ──generates──> calendar_events(source='workout')
transactions(transfer_to_savings) ──> goal_contributions ──> goals.current_amount
list_items(shopping, purchased) ──optional──> transactions(expense)
allergies.triggers / food_restrictions.foods ──flag──> recipes, meal_plan_entries (never "safe")
pet_supplies / craft supplies ──are──> inventory_items(location pets|craft) ──low stock──> shopping
pet / repair / project / celebration costs ──> transactions (linked, recorded once)
craft_items(herb).plant_id ──> plants ;  celebrations ──> calendar_events, lists(shopping), recipes
chores.pet_id / chores.project_id ──> pet care & project tasks on everyone's chore lists
```

---

## 5. Automation engine

All recurring things reference `recurrence_rules`. A single **materialiser** (`src/lib/automation`)
expands rules into concrete rows (chore occurrences, event instances, workout calendar entries)
over a rolling horizon (default 30 days). It is idempotent, keyed on `(template_id, due_date)`.
It runs on demand (on page load for the family, cheap) and can later move to a cron job.
Each automation has an on/off switch in `automation_settings` (JSONB on `families.settings`),
so users can always edit or disable it.

---

## 6. Data access & security

* **Data Access Layer** (`src/lib/dal.ts`): the only place that reads the session.
  `getViewer()` returns `{ user, member, family, permissions }` or redirects.
  `requireParent()`, `requireModule(module, level)` guard Server Actions.
* Every query is written through helpers that take the viewer and **always** filter by
  `viewer.family.id`. Server Actions re-check authorization and never trust IDs from the client.
* `proxy.ts` does an optimistic cookie-presence redirect only; the real check is in the DAL.
* Session cookie: `httpOnly`, `secure` in production, `sameSite=lax`, 30-day expiry.
  Token stored as SHA-256 hash, so a DB leak doesn't leak live sessions.
* Passwords: bcrypt (cost 12).
* Hardening planned for production: Postgres Row-Level Security policies keyed on a
  `app.family_id` setting as defence-in-depth, rate limiting on auth endpoints.

## 7. File & image storage

`files` table + a storage adapter interface (`put`, `get`, `delete`, `url`). Local disk adapter for
development, S3-compatible adapter for production. Uploads are resized server-side to a max edge
of 2048px plus a 320px thumbnail (WebP), stored as two keys on the same `files` row.

## 8. Design system

**Warm + modern + organised + family-friendly.** Neutral linen base, sage-green primary,
terracotta and honey accents, soft shadows, generous radius.

* **Tokens** (`src/app/globals.css`): colours (`--color-canvas`, `--color-surface`, `--color-ink`,
  `--color-muted`, `--color-line`, `--color-primary-*`, `--color-clay-*`, `--color-honey-*`,
  status colours), radius (`--radius-card: 1.25rem`, controls `0.75rem`), shadows.
* **Type**: *Fraunces* (display, headings) + *Inter* (UI text). Scale: 12 / 14 / 16 / 20 / 24 / 32.
* **Spacing**: 4px base; cards use 20px (mobile) / 24px (desktop) padding; grid gaps 16/24px.
* **Controls**: all buttons/inputs are 44px tall (touch target), `sm` 36px for dense desktop UIs.
* **Components** (`src/components/ui`): Button, IconButton, Card, Field/Input/Textarea/Select,
  Checkbox, Toggle, Badge, Avatar, ProgressBar, ProgressRing, Modal/Sheet, Tabs, EmptyState,
  PageHeader, Table, Skeleton. Domain widgets build only on these.
* **Member colours**: each member has a colour used consistently on avatars, calendar events,
  chore chips and reports.
* **Alerts**: status uses soft tinted backgrounds (honey for "soon", clay for "overdue/expired"),
  never full-red screens.

## 9. Responsive strategy

* Mobile-first Tailwind; three breakpoints (`sm` 640, `lg` 1024, `xl` 1280).
* Mobile: bottom tab bar, full-height sheets instead of centred modals, swipe-to-complete on chore
  rows, sticky "today" headers, camera barcode scanning, large checkboxes.
* Tablet: two-column dashboards, icon-rail nav.
* Desktop: sidebar + multi-column widget grid; blueprints get full canvas + inspector panel.
* Blueprint editors use pointer events (mouse, touch and pen with one code path).

## 10. Development phases

| Phase | Scope | Status |
|---|---|---|
| 1. Foundation | Auth, onboarding, family & members, permissions, dashboard & widgets, navigation, design system, full DB schema | ✅ Done |
| 2. Household | House overview, cleaning (daily → annual + custom), chores with per-person checklists & history, maintenance, tasks, projects, documents, important info, lists (checklist/bullet/numbered/to-do), calendar (month/week/day/list, per-event visibility) | ✅ Done |
| 3. Kitchen | Inventory (pantry/fridge/freezer/supplies), barcode scanning, expiration groups & used/discarded/donated/replaced, recipes with collections & printable books, weekly meal planner with pantry check, shopping lists by aisle | ✅ Done |
| 4. Garden & Farm | Plant database (36 reference plants + custom), drag-and-drop garden & farm blueprints, plantings & garden log, harvests → kitchen, animals, health, feed, production → kitchen | ✅ Done |
| 5. Personal | Journal (private/shared, moods, photos, timeline/calendar/search), goals & savings with milestones, fitness plans/logs/PRs/metrics, food journal | ✅ Done |
| 6. Financial | Budget categories & limits, income sources, transactions (recurring), savings transfers → goals, shopping trip → expense | ✅ Done |
| 7. Advanced | Reports (cleaning, garden, farm, kitchen waste, budget, fitness, goals), automation engine with per-family switches, notifications + preferences, global search, dashboard customization, category manager | ✅ Done |
| 8a. Medical | Health profiles, allergies, food restrictions, conditions, medications (refills), documents, medical calendar, privacy per record, allergy & diet warnings in recipes and meal plans | ✅ Done |
| 8b. Pets | Pet profiles & galleries, medical records, preventatives with reminders, food & supplies (inventory → shopping), care schedules (chores), special care, memories (journal) | ✅ Done |
| 8c. Spiritual (formerly Witchcraft) | Accurate moon phases & signs, Wheel of the Year with detail pages and custom dates, celebration planner, spells, rituals, printable grimoire, crystals & collection, herbs (safety-first, garden-linked), tools, magical wellness, supplies | ✅ Done |
| 9. Everyday extras | Points & rewards with approvals and fair-share view, take-turns rotation, cleanliness meters, recipe import & cook mode, “What can I cook?”, shopping prices / totals / buy again, copy meal week, home inventory & insurance report, service providers, household manual | ✅ Done |
| 8d. Home maintenance | Rooms & systems, preventative schedules with costs & history, repair log with photos & warranties, remodeling projects (stages, tasks, materials, budget, photos), to-do lists, documents & warranties, 12-month calendar | ✅ Done |

## 11. How the areas connect (implemented)

* **Kitchen → Recipes → Meal plan → Shopping → Inventory**: recipe ingredients are parsed
  (`src/lib/ingredients.ts`) and compared with active inventory; missing items go to the main
  shopping list; checked items are “put away” back into inventory.
* **Garden → Harvest → Kitchen** and **Farm → Production → Kitchen**: `addToInventory` merges produce
  into kitchen stock and records an `inventory_events` row with the source.
* **Chores → Calendar → Notifications**: occurrences are materialised daily, shown as a calendar layer
  and announced via `notify()`.
* **Budget → Savings → Goals**: savings transfers create goal contributions, tick milestones and mark goals
  achieved.
* **Fitness → Calendar**: weekly workout schedules appear as a calendar layer.
* **Medical → Recipes & Meals**: food allergies and restrictions (expanded through allergen groups in
  `src/lib/allergen-groups.ts`, e.g. cheese → mozzarella) flag recipe ingredients and planned meals.
  Without a match the app only says no recorded conflicts were found.
* **Pets / Spiritual → Inventory → Shopping**: supplies live in the shared inventory (`location` pets,
  craft); low stock is added to the shopping list automatically.
* **Pets, Maintenance, Celebrations → Budget**: costs are recorded once as linked transactions.
* **Calendar layers**: medical appointments and celebrations are events; pets (preventatives & vet dates),
  home projects (repairs, stages, warranties) and moon & sabbats are optional layers.
* **Everything → Activity feed & Search**: actions log to `activity_log`; `src/lib/search.ts` searches every
  area with the same permission rules as the pages.

## 12. Testing

* `npm test`: unit tests for the recurrence engine, timezone maths, ingredient parsing/matching,
  allergen matching, moon phases/signs (against published USNO times), equinoxes/solstices and the
  Wheel of the Year (both hemispheres, overrides), cleanliness meters, and recipe import (JSON-LD,
  pasted text, step timers).
* `npm run typecheck`, `npm run lint`, `npm run build`.
* `npm run db:seed`: demo Vanderbilt family covering every area.
