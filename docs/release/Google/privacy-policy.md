# DragonFlow Privacy Policy

**Last updated:** 2026-10-11

DragonFlow ("the app") is a personal and family task-management app for Android, developed by Eyal Peleg. This policy explains what data the app handles and how.

## Summary

DragonFlow is local-first. Your tasks, categories, and settings are stored only on your device unless you explicitly turn on Google Drive backup. The app does not show ads, does not use advertising or analytics trackers, and does not sell or share your data with any third party.

## Data we store on your device

All task data you create — titles, descriptions, priorities, categories, due dates, sub-tasks, recurrence settings, completion comments — is stored locally on your device using Android's app-private storage. We never see this data; it never leaves your device unless you turn on Drive backup (below).

## Google Drive backup (optional)

If you choose to sign in with Google and enable backup, DragonFlow uses Google Sign-In to authenticate you and the Google Drive API to store a backup of your task data.

- **What's collected:** your Google account email address and display name (from Sign-In, used only to show you which account is connected), and your task/category data (in the backup file itself).
- **Where it goes:** the backup file is written to the **App Data folder** in your own Google Drive — a private, app-only storage area that does not appear in your regular Drive file list and that no one else (including us) can access.
- **Who can see it:** only you, via DragonFlow signed in to that same Google account. We do not have access to your Drive or your backup file.
- **Transit security:** all communication with Google's servers uses HTTPS encryption.
- **Deleting it:** sign out of Drive backup in Settings, or revoke DragonFlow's access from your Google Account's third-party access settings, at any time. Uninstalling the app removes all local data; the Drive backup file (if any) is removed when you delete it from your Google Account's app-data access page, or automatically if you revoke access.

We do not share this data with any third party. Google Drive is your own storage, not a third-party recipient we transmit data to for our own purposes.

## Permissions the app requests

| Permission | Why it's needed |
|---|---|
| `SYSTEM_ALERT_WINDOW` (display over other apps) | Powers the optional floating task bubble — a small overlay showing your next/urgent task. You explicitly grant this from the app's Settings screen; it can be revoked at any time in Android Settings. |
| `FOREGROUND_SERVICE` / `FOREGROUND_SERVICE_SPECIAL_USE` | Keeps the floating bubble alive while you have it enabled. Android requires a foreground service for any overlay that persists outside the app. |
| `SCHEDULE_EXACT_ALARM` | Lets task due-time and Pomodoro-timer notifications fire at the exact minute you scheduled, not an approximate time. |
| `RECEIVE_BOOT_COMPLETED` | Restores the floating bubble after you restart your device, if you had it enabled before. |
| `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `MODIFY_AUDIO_SETTINGS` | Used to play short local alert sounds (e.g. task/Pomodoro completion chimes) bundled with the app. |
| `RECORD_AUDIO` | Included automatically by the audio library DragonFlow uses for sound playback. **DragonFlow never records audio** — this permission is not exercised by the app's own code. |
| `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` (older Android versions only) | Lets you export/import your task data as a JSON file on devices running Android 12 and below. Not used on newer Android versions, which use the system file picker instead. |
| `INTERNET` | Required for the optional Google Drive backup/restore feature described above. |
| `VIBRATE` | Used for notification feedback. |

## Children's privacy

DragonFlow is a general-purpose productivity app not directed at children and does not knowingly collect data from children.

## Changes to this policy

If this policy changes, the "Last updated" date above will change and the new version will be published at the same URL.

## Contact

Questions about this policy or your data: **eyalpeleg@gmail.com**
