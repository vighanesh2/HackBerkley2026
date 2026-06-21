# Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase/schema.sql` in **SQL Editor**
3. Copy **Project URL** and **anon public** or **publishable** key to `.env.local` (save the file to disk):
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   # or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
   Do **not** leave `your-anon-key` — that placeholder causes "Invalid API key".
4. Restart `npm run dev` after editing `.env.local`.
5. Verify: open `http://localhost:3000/api/health/supabase` — should return `{"ok":true}`.
6. In **Authentication → URL Configuration**, add:
   - Site URL: `http://localhost:3000` (or your Vercel URL)
   - Redirect URLs: `http://localhost:3000/auth/callback`
7. Enable **Email** provider with **Email + password** (Authentication → Providers → Email).
8. For local dev, turn **off Confirm email** so sign-up/sign-in never sends mail and avoids rate limits.
9. **Recommended:** add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (never expose to the browser). Sign-up via `/api/auth/signup` confirms the user instantly — **zero emails sent**.
10. Optionally enable **Google** OAuth (no Supabase email quota used).

## Email rate limit exceeded?

Supabase free tier caps auth emails (~few per hour). Fixes:

1. **Add `SUPABASE_SERVICE_ROLE_KEY`** to `.env.local` and restart `npm run dev` — sign-up skips email entirely.
2. **Use Sign in** with an existing password (never sends email).
3. **Disable Confirm email**: Authentication → Providers → Email.
4. **Wait ~1 hour** for the quota to reset, or configure **custom SMTP** for production.

## What gets saved (optional)

Signed-in users can persist drawing sessions in `drawing_sessions` and reference images in the `drawing-references` storage bucket. The app also works without Supabase using in-memory sessions.

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Start a diagram practice session |
| `/draw/[sessionId]` | Canvas + vision coach |
| `/login` | Sign in / sign up (optional) |
