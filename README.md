# Chorus

A mobile-first PWA for sharing household chores fairly between members.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router), React 19 |
| Database & auth | Supabase (Postgres + RLS, magic link + Google OAuth) |
| Styling | Custom CSS variables in `app/globals.css` |
| Hosting | Vercel, region pinned to `syd1` |

Vercel is pinned to Sydney in `vercel.json` to sit close to the Supabase database. Changing that region will slow every query.

## Running locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000

## Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable key |

Both are set in the Vercel project settings. `lib/config.ts` falls back to hardcoded values if the variables are absent. Both are public by design — Row Level Security is what protects the data, so no secret belongs in this repo.

## Structure

```
app/
  page.tsx            entry, routes to home / login / setup
  home/               Board tab — today's chores, complete/skip/defer/hand off
  household/          Household tab — members, effort split, chores by room
  chores/             create, edit and archive chores
  activity/           Activity tab — recent history
  auth/callback/      OAuth code exchange
  setup/              first-run household creation
  login/              sign in
  nav.tsx             bottom tab bar
  top-bar.tsx         sticky header with wordmark and avatar
lib/
  config.ts           env, colours, cookie names
  session.ts          loads the signed-in member and their households
  supabase/           browser and server clients
  recurrence.ts       recurrence helpers
  icons.tsx           inline SVG icons
db/
  schema.sql          full database rebuild script
```

## Database

All recurrence and scheduling logic lives in Postgres, not TypeScript. `db/schema.sql` recreates the entire structure: tables, enums, indexes, functions, RLS policies and the cron job.

Key functions:

- `chorus_next_date(...)` — given a schedule and a cursor date, returns the next matching date
- `sync_all_occurrences()` — creates one open occurrence for each active chore that has none
- `create_household(...)` — creates a household and its first member
- `link_member_on_signup()` — trigger on `auth.users` that links an invited member row to a new account

`sync_all_occurrences()` runs via pg_cron hourly at 7 minutes past.

**Note:** the sync creates only a single open occurrence per chore at a time, so the database never holds a full forward schedule. Any feature needing a future window (for example a planned-effort split over the next four weeks) must either extend the sync to a date horizon or compute dates from the recurrence rules directly.

## Design decisions

- Three tabs: Board, Household, Activity
- Tap a row for an action sheet; tap the dot to complete instantly with an undo toast
- Weights are Quick (1), Normal (2), Effort (3), Big job (5), hidden from the UI
- Recurrence is Daily / Weekly / Monthly / Every N — no custom builder
- Rooms are free text with suggestions from previous entries
- No scoring or leaderboard; trend dots show history by member colour
- Deferred past v1: notifications, calendar view, cover bonus

## Deployment

Vercel builds from this repository. Pushing to the default branch deploys to production.
