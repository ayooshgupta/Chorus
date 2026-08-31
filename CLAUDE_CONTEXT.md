# Chorus — Claude Session Context

This file gives Claude the context it needs to work on this project. Paste your GitHub PAT at the start of each session.

## Dev Loop

1. Ayoosh pastes a fine-grained GitHub PAT (scoped to this repo, Contents read/write)
2. Claude clones the repo, reads the code, makes edits
3. Claude commits and pushes directly to `main`
4. Vercel auto-deploys from `main` (Sydney region `syd1`)
5. Database changes go through Supabase MCP (project ID: `trijworqombajiutmfcx`)

No local dev environment exists. No manual file uploads. This is the full loop.

## Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Database | Supabase Postgres with RLS, pg_cron |
| Auth | Supabase (magic link + Google OAuth) |
| Styling | CSS variables in `app/globals.css`, Montserrat font |
| Hosting | Vercel (Hobby plan, `syd1` region) |
| Repo | github.com/ayooshgupta/Chorus (public) |
| Vercel team | APVS Consulting (`team_KK0SMBlp8rc4MSaoKmNTrtIE`) |

## Key Files

```
app/
  home/page.tsx, board.tsx    Board tab — today's tasks, action sheet
  household/page.tsx          Chores tab — effort bars, chore list by room
  household/settings/         Settings — rename household, manage members
  activity/page.tsx           Activity tab — recent feed
  chores/chore-form.tsx       New/edit chore form
  auth/callback/route.ts      OAuth code exchange
  login/page.tsx              Sign in
  setup/                      First-run household creation
  nav.tsx                     Bottom tab bar (Board, Chores, Activity)
  top-bar.tsx                 Sticky header with wordmark + avatar
  page-header.tsx             Shared header (household name + optional stat)
  globals.css                 All styles, CSS variables, design tokens
lib/
  config.ts                   Supabase URL/key, colours, cookie names
  session.ts                  Loads signed-in member + households
  recurrence.ts               Recurrence helpers, date math
  supabase/server.ts          Server-side Supabase client
  supabase/browser.ts         Browser-side Supabase client
db/
  schema.sql                  Full database rebuild script
```

## Design Tokens (from globals.css)

- `--accent-text: #0f6e56` (teal — used for section headers, active tab, selected states)
- `--accent: #1d9e75` (green — borders on selected items)
- `--accent-bg: #e1f5ee` (light green — selected backgrounds)
- `--text: #22201d`, `--text-soft: #6b6862`, `--text-faint: #9b978f`
- `--bg: #faf9f7`, `--surface: #ffffff`, `--surface-alt: #f3f1ed`
- `--danger: #c2412c` (red — overdue, archive, errors)

## Design Principles

- Mobile-first PWA for two-person households
- No leaderboards, no competitive scoring — fair distribution focus
- Honest UX: real data, no misleading simplifications
- Section headers: 13px semibold teal, consistent across all tabs
- Back buttons: bare ← arrow, no label
- Mockups before code for UI changes
- Ask before building; flag edge cases

## Database Notes

- `sync_all_occurrences()` runs hourly via pg_cron — creates ONE open occurrence per chore (not a date horizon)
- Planned bar computes from recurrence rules + weights, not materialised rows
- `chorus_next_date()` is the recurrence engine (daily/weekly/monthly, supports intervals)
- RLS uses `my_household_ids()` — all tables scoped to authenticated user's households
- Weights: Quick(1), Normal(2), Effort(3), Big job(5) — hidden labels in UI

## Current State (after Round 5)

- Tab: "Chores" (was "Household")
- No subheadings on any page
- Effort bar + Planned bar same thickness, notch on effort bar
- Room headers: teal, not uppercase
- Legend shows "/wk" units
- Settings page heading: "Settings"
- Sign-in bug resolved (was PKCE cookie mismatch from rollback)

## Pending / Known Issues

- Planned bar says "next week" but actually shows overall weekly load from recurrence rules — acceptable for now
- Future: extend sync to date horizon OR compute from recurrence rules for a true "next 4 weeks" bar
- KeepInTouch and DivvyUp are separate projects under APVS Consulting umbrella
