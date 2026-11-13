# Vanderbilt Family

A family home-management app: chores, cleaning, calendar, lists, kitchen inventory, recipes, meal
planning, shopping, garden, farm, journal, goals, fitness, budget and reports, all connected, with
per-member portals and parent-controlled permissions.

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for the architecture, database schema,
permissions model, design system and how the areas connect.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · PostgreSQL · Drizzle ORM · Zod · sharp

## Getting started

Requirements: Node 20+ and PostgreSQL 14+.

```bash
cp .env.example .env            # set DATABASE_URL
npm install
npm run db:migrate              # create tables
npm run db:seed                 # optional: demo Vanderbilt family
npm run dev                     # http://localhost:3000
```

Demo logins (password `vanderbilt123`): `sarah@vanderbilt.family` (parent, owner),
`michael@vanderbilt.family` (parent), `emma@vanderbilt.family` (family member with limited access).
Or create your own account at `/signup`; the setup wizard walks you through the rest.

Uploaded photos and documents are stored in `./storage` (set `STORAGE_DIR` to change it).

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm test` | Unit tests (recurrence, timezones, ingredient parsing) |
| `npm run typecheck` | Route types + TypeScript check |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a migration after changing `src/db/schema` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Load the demo family |

## What's inside

| Area | Highlights |
|---|---|
| Home | Today-first dashboard with 22 customizable widgets, announcements, family activity |
| Family | Member portals (“Emma's Home”), roles, logins, per-area permissions |
| Calendar | Month / week / day / agenda, recurring events, per-event visibility, layers for chores, workouts, meals, harvests, animal care, pets, home projects and moon & sabbats |
| House | Cleaning (daily → annual) with room-by-room cleanliness meters, chores with per-person checklists and take-turns rotation, tasks, points & rewards with parent approval and a fair-share view, important info |
| Home Maintenance | Rooms & systems, maintenance schedules with costs, repair log with photos & warranties, remodeling projects, to-do lists, documents & warranties, home inventory with insurance report, service providers, printable household manual, calendar |
| Medical | Private health profiles, allergies & food restrictions (flagged in recipes and meal plans), conditions, medications with refill reminders, documents, appointments |
| Pets | Pet profiles & photos, vet records, flea/tick/heartworm reminders, food & supplies, care chores, memories |
| Witchcraft | Moon phases, Wheel of the Year, celebrations, spells, rituals, printable grimoire, crystals, herbs (with safety notes), tools, wellness, supplies |
| Lists | Checklist, bullet, numbered and to-do lists (due dates, owners, repeats), private or shared |
| Kitchen | Pantry / fridge / freezer / supplies, gentle expiration alerts, barcode scanning, waste tracking, “What can I cook?” with use-it-up suggestions |
| Meals & recipes | Recipe book with pantry check and printable books, import from a link or pasted text, cook mode with step-by-step view and timers, weekly planner (copy last week), auto-built shopping lists with prices, totals and “buy again” |
| Garden | Plant database, drag-and-drop bed planner, plantings, garden log, harvest totals, seeds |
| Farm | Animals & flocks, health records, feed, production charts, drag-and-drop farm map |
| Journal | Private or shared entries with moods, photos and tags; timeline, calendar and search |
| Goals | 6-month to 20-year goals, milestones, projections, budget-funded savings |
| Fitness | Plans with weekly schedules, workout logs, personal records, measurements, food journal |
| Budget | Income, bills, expenses, savings rate, category limits, recurring transactions |
| Reports | Cleaning, garden, farm, kitchen, budget, fitness and goal history |
| Everywhere | Global search, notifications, Quick Add (press **N**), mobile tab bar & swipe-to-complete |

## Install as an app

Vanderbilt Family is an installable web app (PWA):

* **Android (Chrome) and desktop Chrome/Edge:** tap **Install app** (Home banner, phone "More" menu, or the
  sidebar on desktop) and confirm. It opens full-screen with its own icon.
* **iPhone/iPad (Safari):** tap **How to** on the Home banner (or **Install** in "More") for the
  Share → **Add to Home Screen** steps. Only Safari can add apps to the iPhone Home Screen.

The service worker (`public/sw.js`) caches only static app files and shows an offline page with no
connection. Family data, pages and uploaded files are never cached on the device. Icons are generated
from the brand mark with `node scripts/generate-icons.mjs`.

## Deploying (Netlify + Supabase)

**Database (required).** Create a Supabase project, open **Connect**, copy the **Transaction pooler**
connection string (port 6543, password filled in; best for serverless hosting like Netlify), and add it in
Netlify as `DATABASE_URL`. Netlify DB
(`NETLIFY_DB_URL`) or any other Postgres also works. Every deploy runs `npm run db:setup`
(`netlify.toml`): migrations, plus the demo family on a brand-new empty database only. It never resets
existing data. Set `SEED_DEMO=0` to skip the demo family.

**File uploads (optional, recommended with Supabase).** Add in Netlify:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | Project URL, e.g. `https://abcd1234.supabase.co` |
| `SUPABASE_SECRET_KEY` | A **secret** key (`sb_secret_…`) or the legacy `service_role` key |

Photos and documents then go to a **private** Supabase Storage bucket named `uploads` (created
automatically; override with `SUPABASE_BUCKET`). The app serves files itself after checking family
membership and medical privacy, so the bucket stays private and the key never reaches a browser.
Without these, uploads use Netlify Blobs on Netlify, or `./storage` locally. `STORAGE_DRIVER` =
`supabase` | `blobs` | `disk` forces a choice.

Something wrong? Open **`/api/health`** on your site: it checks the database and storage setup and explains
the problem in plain English (it shows no passwords or family data).

Then redeploy and sign in with `sarah@vanderbilt.family` / `vanderbilt123`. Change passwords under the
avatar menu → **Account & password** (parents can reset a member's password from Family → person →
**Manage**), and change or remove the demo accounts before adding real information.

## Project layout

```
docs/ARCHITECTURE.md       architecture & data model
drizzle/                   SQL migrations
tests/                     unit tests
src/db/schema/             database schema (one file per domain); seed.ts demo data
src/lib/                   domain logic: dal (auth/permissions), automation, recurrence, calendar,
                           chores, kitchen, ingredients, garden, farm, goals, budget, reports, search…
src/app/actions/           server actions (validated, authorised via the DAL)
src/app/(auth)/            login & signup
src/app/onboarding/        10-step first-time setup
src/app/(app)/             the signed-in app
src/components/            design system (ui/), forms kit, charts, blueprint editor, feature components
```
