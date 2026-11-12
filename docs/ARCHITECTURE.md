# Hearth — Family Home Management App: Architecture

> Working name: **Hearth**. One cohesive app for running a family household: chores, calendar,
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
| **Household** | Family, House (cleaning, chores, maintenance, projects, documents), Lists |
| **Kitchen** | Kitchen (pantry/fridge/freezer/supplies), Meals, Recipes |
| **Land** | Garden, Farm |
| **Personal** | Journal, Goals, Fitness |
| **Money** | Budget |
| **Admin** | Reports, Settings |

* **Desktop (≥1024px):** persistent left sidebar with grouped icon + label nav; top bar with the
  member switcher, notifications, and the universal **+ Add** button.
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
/family/[memberId]                   member portal ("Emma's Home")
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
2. **Module access.** `member_permissions(member_id, module, level)` with `level ∈ none | view | edit`.
   Parents implicitly have `edit` everywhere. New members get sensible defaults (§3.1).
3. **Record visibility.** Shareable records (events, lists, journal entries, documents, goals,
   household info) have a `visibility` column:
   * `family`: everyone with module `view`.
   * `private`: only the creator (and, for non-journal records, parents).
   * `selected`: only members listed in `record_access` (plus parents).
   `record_access(entity_type, entity_id, member_id, can_edit)` holds the explicit list. This is the
   "Visible to ☑ Mom ☑ Dad ☑ Emma ☐ Jack" control.
4. **Assignment.** Members can always see and complete items assigned to them (chores, tasks,
   checklist items), even if they only have `view` on the module.

Journal entries marked `private` are visible **only to their author**, parents included. A
private journal has to be private.

### 3.1 Default member permissions

| Module | Default for `member` |
|---|---|
| calendar, chores, lists, recipes, meals, journal, goals, fitness | `edit` (scoped by visibility/assignment) |
| house, kitchen, garden, farm, shopping | `view` |
| budget, reports, settings | `none` |

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
* `activity_log`: family feed ("Emma completed Clean Kitchen")
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
```

---

## 5. Automation engine (Phase 7, designed now)

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
| **1. Foundation** | Auth, onboarding, family & members, permissions, dashboard shell & widgets, navigation, design system, full DB schema | **This build** |
| 2. Household | House, cleaning, chores (+ recurrence materialiser), tasks, lists, calendar | Next |
| 3. Kitchen | Inventory, barcode scanning, expiration alerts, recipes, meal planning, shopping lists | |
| 4. Garden & Farm | Plant DB, garden blueprint, garden log, animals, production, farm blueprint | |
| 5. Personal | Journal, goals, fitness, food journal | |
| 6. Financial | Budget, income, expenses, savings goals | |
| 7. Advanced | Reports, automation toggles, analytics, advanced dashboard customisation, global search | |
