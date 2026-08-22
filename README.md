# منصة تنظيم — Tasks, Timer & Goals PWA

Arabic RTL, dark-glassmorphism productivity PWA: tasks, schedule, work timer + Pomodoro,
goals, weekly summary, a strict anti-hallucination AI side chat + daily plan, web push,
and two-way Google Calendar sync. Single-user (no login); data syncs across devices via Supabase.

## Run locally

```bash
npm install
npm run dev
```

Then open the printed local URL. Build for production with `npm run build && npm run preview`.

Environment is already configured in `.env` (Supabase URL + anon key + VAPID public key).
`.env.example` documents the variables. Server-only secrets (NVIDIA key, VAPID private key,
Google client secret) live **only** in a private `app_config` table read by Edge Functions —
never in the frontend bundle.

## Backend (Supabase project `tanzeem`)

- **Tables:** settings, goals, tasks, sessions, achievements, chat_messages, daily_plans,
  push_subscriptions, calendar_sync, calendar_events, app_config (+ `goal_progress` view).
- **Edge Functions:** `ai-chat`, `ai-daily-plan`, `send-push`, `schedule-check`, `google-calendar`.
- **Cron:** `pg_cron` runs `schedule-check` every minute for due-task reminders.
- **AI model:** `meta/llama-3.3-70b-instruct` on NVIDIA NIM (tool-calling; action tools are
  only exposed when the message is an explicit action request, and require user confirmation).

## Regenerating icons

```bash
node scripts/gen-icons.mjs
```

## Installing as an app

- **Laptop:** an install prompt appears; or use the browser's install button.
- **iPhone (iOS 16.4+):** Safari → Share → Add to Home Screen. Push notifications only work
  after it's installed to the Home Screen.

## Enabling Google Calendar sync (optional — everything else works without it)

1. In Google Cloud Console: create an OAuth 2.0 Client (type: Web application).
2. Add this **Authorized redirect URI** exactly:
   `https://dtlcgqiqctdrcijcubbm.supabase.co/functions/v1/google-calendar/callback`
3. Enable the **Google Calendar API** for the project.
4. Give me the Client ID + Client secret (I'll store them in `app_config`), or run:
   ```sql
   update app_config set value = 'YOUR_CLIENT_ID' where key = 'GOOGLE_CLIENT_ID';
   update app_config set value = 'YOUR_CLIENT_SECRET' where key = 'GOOGLE_CLIENT_SECRET';
   ```
5. Open Settings → تقويم Google → ربط.

## Notes / tradeoffs

- **No authentication** by design: anyone with the app URL + public anon key can read/write
  the data. Acceptable for a personal app. An app-level passcode can be added later if wanted.
