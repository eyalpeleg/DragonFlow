# DragonFlow — Play Store Listing Copy

Ready-to-paste content for Play Console → **Main store listing**. Pairs with [PLAY_SUBMISSION.md](./PLAY_SUBMISSION.md) (§9) and [privacy-policy.md](./privacy-policy.md).

## App name

DragonFlow

## Short description (≤ 80 chars)

```
A calm, local-first task manager with recurrence, Pomodoro, and a quick bubble
```
(78 chars)

## Full description (≤ 4000 chars)

```
DragonFlow is a straightforward task manager built for everyday life — yours and your family's.

WHAT YOU CAN DO
• Create tasks with priority (Critical/High/Medium/Low), category, due date & time, and sub-tasks
• Set up daily, weekly, or monthly recurring tasks that regenerate automatically
• Organize with color-coded categories — use the built-in ones or create your own
• Track progress with a daily dashboard (today's stats, category breakdown) and a weekly view (time spent, completions)
• Stay focused with a built-in Pomodoro timer
• See your most urgent task at a glance with an optional floating bubble overlay — no need to reopen the app
• Get reminders exactly when you need them: task due times, daily summaries, and Pomodoro alerts
• Archive finished tasks and restore them later; leave a completion note when you check something off
• Switch between light and dark themes
• Export and import your data as a file, or back it up to your own Google Drive — fully optional, and always under your control

WHAT DRAGONFLOW DOESN'T DO
• No ads
• No analytics or tracking
• No account required — all data stays on your device unless you turn on Google Drive backup yourself

DragonFlow is built for people who want a task manager that gets out of the way: clear priorities, simple recurrence, and a quiet nudge when something's due — without the enterprise-software clutter.
```
(~1,180 chars — well under the 4000 limit; trim or expand as you like)

## Release notes — first release (≤ 500 chars per locale, plain text, no markdown)

```
First release.
• Tasks with priority, category, due date/time, and sub-tasks
• Daily/weekly/monthly recurrence
• Daily and weekly progress dashboards
• Pomodoro timer
• Floating task bubble overlay
• Due-time and Pomodoro notifications
• Archive and restore completed tasks
• Light/dark theme
• Optional Google Drive backup and JSON export/import
```

## App details

| Field | Value |
|---|---|
| App category | Productivity |
| Tags | task manager, to-do list, productivity, pomodoro |
| Contact email | eyalpeleg@gmail.com |
| Website | *(optional — omit, or add later if you stand up a project page)* |
| Privacy policy URL | *(needs public hosting — see "Still needed" below)* |

## Graphic assets — still to create

Nothing here is text I can draft; these need real device/image work:

- **App icon**: 512×512 PNG, 32-bit — export/resize from [`assets/images/icon.png`](../../assets/images/icon.png).
- **Feature graphic**: 1024×500 PNG/JPG — a simple hero banner (e.g. app name + a task-card visual on the purple brand background `#1F0A3D`).
- **Phone screenshots**: min 2, max 8, from a real device. Suggested shots: tasks tab with a few tasks visible, the daily dashboard, a task card with sub-tasks expanded, and the floating bubble over another app.

## Privacy policy — still needed: a public URL

The content is written ([privacy-policy.md](./privacy-policy.md)), but Play Console requires a **live, publicly reachable URL** — a markdown file in the repo doesn't satisfy that. Options, cheapest first:
1. **GitHub Pages** on this repo (Settings → Pages → serve `/docs`) — free, and the file is already in `docs/`. Needs you to flip the Pages setting on in the repo (a repo-settings change, so it's your call to make).
2. A free static host (Netlify/Vercel) pointed at the same markdown rendered as HTML.
3. Any existing personal site/domain you already have.

## Data Safety form — answers (updated, parking-reminder removed)

Matches [PLAY_SUBMISSION.md §7](./PLAY_SUBMISSION.md#7-data-safety-form-content) — reproduced here for convenience, now that the app has no `PACKAGE_USAGE_STATS` / usage-access surface to declare:

- Does your app collect or share any of the required user data types? → **Yes** (Google Drive backup).
- Is all of the user data collected by your app encrypted in transit? → **Yes** (HTTPS to Google APIs).
- Do you provide a way for users to request their data be deleted? → **Yes** (sign out, or delete the backup file from Drive app-data access).
- **Personal info → Name, Email address** — from Google Sign-In only. Purpose: **App functionality (authentication)**. Required for backup, optional overall (backup itself is opt-in).
- **Files and docs** — not collected by the developer. Backup goes to the user's own Drive `appdata` folder, private to the app, never accessed by anyone else.
- **Data sharing** — none. No third-party recipients.
