# Chorus — Claude Session Context

This file gives Claude the context it needs to work on this project. Paste your GitHub PAT at the start of each session.

_Last refreshed: 2026-09-05, against commit `5a1fffa` (latest on `main`, matches the live production deployment). Per-member reminder timing (below) is committed locally on top of that but not yet pushed/deployed._

## Dev Loop

1. Ayoosh pastes a fine-grained GitHub PAT (scoped to this repo, Contents read/write)
2. Claude clones the repo, reads the code, makes edits
3. Claude commits and pushes directly to `main`
4. Vercel auto-deploys from `main` (Sydney region `syd1`)
5. Database changes go through Supabase MCP (project ID: `trijworqombajiutmfcx`)

The repo also happens to build locally (`npm install && npm run build`) if a local check is ever useful, but there's no local dev server workflow — verify changes via Vercel preview/production instead.

## Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Database | Supabase Postgres with RLS, pg_cron |
| Auth | Supabase (magic link + Google OAuth), multi-household support |
| Email | Gmail SMTP via nodemailer (`lib/email.ts`) — not Resend (migrated away) |
| Push | Web Push (VAPID) via `web-push`, service worker at `public/sw.js` |
| Styling | CSS variables in `app/globals.css`, Montserrat font |
| Hosting | Vercel (Hobby plan, `syd1` region) |
| Repo | github.com/ayooshgupta/Chorus (public) |
| Vercel team | APVS Consulting (`team_KK0SMBlp8rc4MSaoKmNTrtIE`, project `chorus`) |

## Key Files

```
app/
  home/page.tsx, board.tsx, actions.ts   Board tab — today's tasks, filter, action sheet, undo toast
  household/page.tsx                      Chores tab — effort bar, planned bar, chore list by room
  household/actions.ts                    Rename household, add/archive member, invite email
  household/settings/                     Settings page, form (rename), member-list (archive)
  household/add-member.tsx                 Add-member form (name/email/colour → invite email)
  activity/page.tsx                       Activity tab — recent feed, deep-links to chores
  chores/chore-form.tsx, actions.ts        New/edit chore form, save/archive/reassign-credit
  chores/[id]/page.tsx, new/page.tsx       Edit / create chore routes
  notifications/actions.ts                 Save/delete push subscription, send test notification
  notifications-toggle.tsx                 Notification opt-in UI (iOS install detection, permission states)
  api/cron/daily-reminders/route.ts        Hourly-triggered due/overdue push digest, filtered to each member's own reminder_hour
  api/test/completion-notification/route.ts  Test route: chore-completed push (no real chore needed)
  api/test/invite-email/route.ts           Test route: preview invite email (no real member needed)
  auth/callback/route.ts                   OAuth/magic-link code exchange
  login/page.tsx                           Sign in (Google + magic link)
  setup/                                   First-run household creation, "create another household"
  profile/actions.ts                       Update display name/colour, switch active household
  settings-sheet.tsx, top-bar.tsx          Profile sheet: name, colour, theme, notifications, household switcher, sign out
  nav.tsx                                  Bottom tab bar (Board, Chores, Activity)
  page-header.tsx                          Shared header (household name + optional stat)
  layout.tsx, manifest.ts                  PWA shell, theme cookie bootstrap, manifest
  globals.css                              All styles, CSS variables, design tokens
public/
  sw.js                                    Service worker — push only, no offline caching
lib/
  config.ts                                Supabase URL/key, member colour palette, cookie names
  session.ts                               Loads signed-in member + all household memberships
  recurrence.ts                            Recurrence math, bucketing, date/time formatting
  email.ts                                 Gmail SMTP transport + invite email template (text + HTML)
  push.ts                                  web-push wrapper, VAPID config, stale-subscription detection
  supabase/server.ts, browser.ts, admin.ts  Supabase clients (server/browser/service-role)
db/
  schema.sql                               Full database rebuild script (captured 2026-08-31)
```

## Design Tokens (from globals.css)

- `--accent-text: #0f6e56` (teal — used for section headers, active tab, selected states)
- `--accent: #1d9e75` (green — borders on selected items)
- `--accent-bg: #e1f5ee` (light green — selected backgrounds)
- `--text: #22201d`, `--text-soft: #6b6862`, `--text-faint: #9b978f`
- `--bg: #faf9f7`, `--surface: #ffffff`, `--surface-alt: #f3f1ed`
- `--danger: #c2412c` (red — overdue, archive, errors)
- Member colour palette (8 fixed hexes): Teal, Coral, Blue, Purple, Pink, Amber, Green, Slate (`lib/config.ts`)

## Design Principles

- Mobile-first PWA for small households (built around two people, but not hard-limited to two)
- No leaderboards, no competitive scoring — fair distribution focus
- Honest UX: real data, no misleading simplifications
- Section headers: 13px semibold teal, consistent across all tabs
- Back buttons: bare ← arrow, no label
- Mockups before code for UI changes
- Ask before building; flag edge cases

## Feature List (current, as of this refresh)

**Auth & onboarding**
- Magic link + Google OAuth sign-in
- Multi-household support — one auth user can belong to several households; a cookie (`chorus_household`) tracks the active one, switchable from the profile sheet
- First-run setup creates a household + first member (`create_household` RPC); "Create another household" available later
- Adding a member sends an invite email (Gmail SMTP) with setup steps (sign in, add to Home Screen, turn on notifications)

**Board tab (Home)** — `app/home/`
- Tasks bucketed into Overdue / Today / This week / This weekend
- Filter: Everyone / a specific member (remembered per device via localStorage, keyed by household) / Unassigned
- Per-task sheet: Complete (with multi-select "who did it" for shared credit), Skip, Hand off to another member, Defer (tomorrow / 3 days / next weekend)
- 5-second undo toast after Complete/Skip, reverses rotation advancement too
- Trend dots per chore (last 10 completions), split-coloured for shared-credit completions
- Chore notes shown read-only in the task sheet when present

**Chores tab (Household)** — `app/household/`
- Effort bar: actual completed workload split by member, last 4 weeks
- Planned bar: upcoming weekly workload computed from recurrence rules × effort weight (not from materialised occurrences) — see known caveat below
- Chores grouped by room, "No room" sorted last
- Each chore row shows recurrence description, note preview, and trend dots

**Chore form** — `app/chores/`
- Recurrence: Daily / Weekly (pick weekdays) / Monthly (day-of-month or nth-weekday) / Every N days-weeks-months
- Effort weight: Quick(1) / Normal(2) / Effort(3) / Big job(5) — hidden numeric labels in UI
- Assignment: One person (dedicated), Take turns (alternating, auto-rotates on complete/skip), Anyone (adhoc, unassigned)
- Room (free text, autocompletes from existing rooms) and optional note (500 char max)
- History list (last 10 closed occurrences) — tap a completed row to reassign who gets credit, including toggling shared credit
- Archive (soft-delete — hides from lists, keeps history)

**Activity tab** — `app/activity/`
- Chronological feed of all household actions (completed, skipped, deferred, handed off, chore created/updated/archived, member joined)
- Shared-credit completions render a split-colour avatar and "X and Y did it" phrasing
- Rows with an associated chore link through to that chore's edit page

**Household settings** — `app/household/settings/`
- Rename household
- Member list: colour dot, name, email, "You" pill, archive with confirmation (soft-delete; reassigns dedicated/rotation chores to adhoc, clears open-occurrence assignments, preserves history)
- Add member (name, email, colour) → triggers invite email
- Archived members shown in a dimmed read-only list

**Profile / settings sheet** — `app/settings-sheet.tsx`, `app/top-bar.tsx`
- Display name (save on blur/Enter) and colour picker, with a brief "Saved" confirmation
- Appearance: Light / Dark / System, persisted via `chorus-theme` cookie, applied pre-hydration in `layout.tsx` to avoid flash
- Notifications toggle (see below)
- Household switcher (all memberships) + "Create another household"
- Sign out

**Push notifications**
- Web Push via VAPID keys, one `push_subscriptions` row per device/member
- Daily reminder: each member picks their own hour (`members.reminder_hour`, 0-23, default 7, in Australia/Sydney) via a "Reminder time" control in the Notifications settings — a compact hour button (1-12, opens an inline 4-column grid on tap, same expand-in-place pattern as the chore form's "+ Add a note") plus an AM/PM `.seg` toggle, not a native `<select>` or a 24-row list; the digest summarises due-today/overdue counts per household and prunes dead subscriptions (404/410) automatically
  - Dispatch is hourly, not once a day — Vercel Hobby cron can't express "whenever it's this member's hour", so `app/api/cron/daily-reminders` is instead called every hour by Supabase `pg_cron` + `pg_net` (job `hourly_reminder_dispatch`, `:10` past the hour) and the route itself filters to members whose `reminder_hour` matches the current hour. `vercel.json` no longer defines a cron — this replaced the old fixed 20:00 UTC job entirely.
- Chore-completed push: sent to every other active, subscribed member when a chore is completed — excludes whoever tapped Complete and whoever got credit; best-effort, never blocks the completion
- The master "Daily reminder" toggle still controls both notification types together (opting in creates the `push_subscriptions` row both checks rely on) — reminder timing is a separate control that only affects when the daily digest fires, shown once the toggle is on
- iOS-aware UI states in the toggle: needs Home Screen install, permission blocked, unsupported browser, on/off
- "Send test notification" button once enabled
- Test/dev-only routes (both require `CRON_SECRET` bearer token): preview the invite email without a real member row, and fire a completion-style push at a member or whole household without touching chore data

**PWA shell**
- `manifest.ts` + icons for installability
- `public/sw.js`: push-only service worker (no offline caching), click-to-focus/open logic keyed by notification `url`
- iOS home-screen install is a prerequisite for push (detected and messaged in the notifications toggle)

## Database Notes

- Tables: `households`, `members`, `chores`, `rotation_members`, `occurrences`, `activity`, `push_subscriptions` — all RLS-scoped via `my_household_ids()` (and `my_member_ids()` for push subscriptions)
- `members.auth_user_id` is deliberately **not unique** — supports one auth user across multiple households
- `sync_all_occurrences()` runs hourly via pg_cron (7 min past the hour) — creates ONE open occurrence per chore, not a date horizon
- `chorus_next_date()` is the recurrence engine (daily/weekly/monthly, supports intervals, nth-weekday and day-of-month monthly patterns)
- Planned bar (Chores tab) computes from recurrence rules + weights, not materialised rows
- `occurrences.credited_members` (uuid[]) supports shared-credit completions; when null, `completed_by` is the sole credit
- Weights: Quick(1), Normal(2), Effort(3), Big job(5) — hidden labels in UI
- `link_member_on_signup()` trigger on `auth.users` links a pre-invited member row (matched by email) to a new auth user on first sign-in
- `members.reminder_hour` (smallint, 0-23, default 7) — the hour in Australia/Sydney each member wants their daily reminder push
- Two pg_cron jobs now: `sync_all_occurrences` (hourly, :07) and `hourly_reminder_dispatch` (hourly, :10 — calls the Vercel reminder route via `pg_net`, auth token read from Supabase Vault secret `cron_secret` rather than embedded in the job)
- `pg_net` extension is enabled (flagged by the security advisor as installed in the `public` schema rather than a dedicated one — cosmetic, not fixed yet, doesn't affect function)
- Schema file (`db/schema.sql`) is a structure-only rebuild script, captured 2026-08-31, updated 2026-09-05 for `reminder_hour` + the new cron job — re-export after significant schema changes

## Known env vars (Vercel)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `NEXT_PUBLIC_APP_URL` (optional, falls back to the vercel.app domain).

## Pending / Known Issues

- Planned bar says "next week" but actually shows overall weekly load derived from recurrence rules — acceptable for now, not a true rolling 4-week forecast
- Undo (5s toast) can't unsend an already-delivered push notification for the chore-completed ping — a known, accepted trade-off
- Test routes under `app/api/test/` are dev conveniences gated by `CRON_SECRET`, not meant for end users — fine to leave in place, but don't build user-facing flows on top of them without reconsidering auth
- `reminder_hour` is a single household-wide timezone assumption (Australia/Sydney, same as `HOUSEHOLD_TZ` everywhere else) — there's no per-user timezone, only per-user hour-of-day within that fixed zone
- Reminder-hour matching is exact-hour, computed fresh on each hourly cron tick — a Sydney DST transition could in theory cause one hour to be checked twice or skipped once a year; not handled specially, low-stakes enough to leave as-is
- Some Supabase MCP actions (enabling extensions, writing to Vault) get blocked by the Claude Code auto-mode permission classifier even with correct/safe SQL — needs the session in a non-auto permission mode (or the user running the SQL directly in the Supabase SQL Editor) to get through
- KeepInTouch and DivvyUp are separate projects under the APVS Consulting umbrella (not part of this repo)
