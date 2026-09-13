# Multi‑user setup — cutover runbook

This describes how to finish turning Tanzeem into a multi‑user app (email link + Google login, per‑user data, admin AI toggle). The **code and the additive database changes are already done**. What remains are a few dashboard steps only you can do, then a data‑linking migration and a deploy.

Supabase project: **tanzeem** (`dtlcgqiqctdrcijcubbm`).
Owner / admin account: **wael.kun16@gmail.com**.

---

## What is already done ✅
- **Database (additive, already applied):** a `profiles` table (role + AI flag), a signup trigger, an `is_admin()` helper, and a nullable `user_id` column on every data table. The live app kept working the whole time.
- **App code:** login screen (email link + Google), an auth gate, per‑user timer/settings, an admin page to toggle AI per user, an “AI not enabled yet” state, calendar removed. Build passes.
- **Edge functions (code updated, NOT deployed yet):** `ai-chat`, `ai-daily-plan`, `send-push`, `schedule-check` now identify the caller and scope data per user; AI is gated on the `ai_enabled` flag.
- **Cutover migration written:** `supabase/migrations/20260913070000_multiuser_cutover.sql` (not applied yet).

## What you must do 🔑 (dashboard — I can’t do these for you)

### 1. Enable login providers
Supabase → Authentication → Providers:
- **Email**: enable, keep **Confirm email** ON.
- **Google**: enable. You’ll need a Google OAuth client:
  - Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID (Web application).
  - Authorized redirect URI: `https://dtlcgqiqctdrcijcubbm.supabase.co/auth/v1/callback`
  - Copy the Client ID + Client secret into Supabase’s Google provider.

### 2. Set the URLs
Supabase → Authentication → URL Configuration:
- **Site URL**: your Vercel production URL.
- **Redirect URLs**: add the Vercel URL and `http://localhost:5183` (for local testing).

### 3. Sign in once as yourself
Run the app (locally: `npm run dev`, or your Vercel preview) and sign in **once** as `wael.kun16@gmail.com` (email link or Google). This creates your account + profile row. **Tell me when this is done** — then I run the rest.

---

## What I do after you sign in 🤖
4. **Run the cutover migration** — links all your existing tasks/sessions/achievements/goals/settings/timer to your account, makes you admin, turns on your AI, restructures the singleton tables, and switches security rules to strict per‑user isolation.
5. **Deploy the 4 edge functions** (`ai-chat`, `ai-daily-plan`, `send-push`, `schedule-check`).
6. **Deploy the frontend** (push to `main` → Vercel).

> Order matters: the cutover migration runs **after** you sign in and **together with / just before** the deploy, so there’s no window where the app is broken. Don’t heavily use/change settings between first sign‑in and the migration.

---

## Verify ✅
- Sign in as yourself → all your old data is present.
- Create a second test account → it sees an empty app and **cannot** see your data.
- In the app, open **الإدارة (Admin)** → you see both users → toggle AI on for the test account → it can now use the assistant; toggle off → it can’t.
- Timer still syncs across your own devices; a test user’s timer is separate.
- Security advisor shows no “anon can read” warnings.

## Notes
- **AI cost:** all users share your provider keys (kept server‑side). You control who can use AI via the admin toggle (off by default for new users).
- **Calendar** is disabled for now; the tables remain but are unused.
- **Rollback:** the additive step is harmless. The cutover is the irreversible part — a Supabase backup is taken automatically, but you can also snapshot before step 4.
