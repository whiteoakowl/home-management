# Vanderbilt Family

A family home-management app: chores, calendar, kitchen, meals, garden, farm, budget, goals,
fitness and journal in one connected place, with per-member portals and parent-controlled
permissions.

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for the information architecture, database
schema, permissions model, design system and build phases.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · PostgreSQL · Drizzle ORM · Zod

## Getting started

Requirements: Node 20+ and PostgreSQL 14+.

```bash
cp .env.example .env            # set DATABASE_URL
npm install
npm run db:migrate              # create tables
npm run dev                     # http://localhost:3000
```

Create an account at `/signup` and the onboarding wizard walks you through setting up the family.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a migration after changing `src/db/schema` |
| `npm run db:migrate` | Apply migrations |

## Project layout

```
docs/ARCHITECTURE.md       architecture & roadmap
drizzle/                   SQL migrations
src/db/schema/             database schema, one file per domain
src/lib/dal.ts             data access layer: session → viewer, permissions, visibility
src/lib/                   domain logic (family, permissions, modules, widgets, dates…)
src/app/actions/           server actions (validated with Zod, authorised via the DAL)
src/app/(auth)/            login & signup
src/app/onboarding/        10-step first-time setup
src/app/(app)/             the signed-in app (dashboard, family, settings, areas…)
src/components/ui/         design-system primitives
src/components/            shell, dashboard widgets, family components
```

## Build status

**Phase 1 (Foundation) is complete:** authentication, family & member management, logins for
members, per-member module permissions, record-visibility model, onboarding, customizable
dashboard with 17 widgets, per-member portals, announcements, activity feed, responsive
navigation (sidebar / icon rail / mobile tab bar), Quick Add, and the full database schema for
every later phase.

Areas built in later phases show a "coming in Phase N" page until they land. See the phase table in
the architecture doc.
