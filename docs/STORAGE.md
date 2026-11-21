# Storage: ready for lots of families

Everything families add lives in two places, both on **Supabase**:

| What | Where | Examples |
|---|---|---|
| Records | Supabase **database** (Postgres) | events, chores, recipes, journals, chat, budgets |
| Photos & files | Supabase **Storage** (private bucket `uploads`) | profile photos, albums, receipts, PDFs |

## What the app already does to save space and stay fast

- **Photos are shrunk on upload** to at most 2048 px (WebP, quality 82) plus a small thumbnail.
  A 10 MB phone photo usually becomes 300–600 KB. Uploads over 10 MB are refused.
- **Fair-use allowance per family:** 10 GB of photos and files (change with the `FAMILY_STORAGE_GB`
  setting in Netlify). Parents see their usage in **Account settings → Photo & file storage**.
- **Indexes on every family/person/file link** (added automatically on each deploy by
  `scripts/ensure-indexes.mjs`), so pages stay quick as tables grow to millions of rows.
- **Hourly housekeeping** (`/api/cron/daily`):
  - removes expired sign-ins and used password links
  - removes read notifications after 90 days (any after a year) and activity history after 13 months
  - removes photos and files nothing uses any more (a replaced photo, a deleted item), after 2 days
  - Family records themselves are never removed by housekeeping.
- **Large files** (PDFs over 4 MB) and large "Download our data" files are handed over as short-lived
  private links straight from storage, so they never hit the host's ~6 MB response limit.
- **Deleting a family** removes its records and all its stored files.
- **Database connections:** the app uses Supabase's transaction pooler with small per-instance pools,
  so traffic spikes don't run out of connections.

## How much space to expect (rough guide)

| | Per family per year | 1,000 families | 10,000 families |
|---|---|---|---|
| Database | 5–25 MB | 5–25 GB | 50–250 GB |
| Photos & files (500 photos) | about 250 MB | about 250 GB | about 2.5 TB |

Most families add far fewer photos; these are generous estimates.

## What you need to do on Supabase (before launch)


1. **Upgrade to the Pro plan** (Supabase → Organization → Billing). The free plan has a small
   database and storage, and **pauses projects after a week without visits**: not OK for a business.
   Pro includes far more database and file storage, daily backups, and lets both grow as you go
   (check supabase.com/pricing for current amounts and prices).
2. **Turn off the Spend Cap** (Billing → Spend cap), so the database and storage keep growing
   instead of turning read-only when a quota is reached. Set a budget alert email instead.
3. **Database → Backups:** confirm daily backups. Once you have paying customers, consider
   **Point-in-Time Recovery** (restore to any minute).
4. **Watch usage monthly:** Supabase → Reports (database size, storage, egress). If pages feel slow
   with many customers, raise **Compute** one size (Project Settings → Compute and Disk).
5. **Netlify:** the free plan is fine to start; move to Pro when traffic grows.
