# Going live: setup checklist

The app uses Supabase when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set (`.env.local` locally,
environment variables on the host). Without them it falls back to the browser-only preview backend.

## 1. Database (Supabase → SQL Editor → New query → paste → Run)
- [x] `migrations/0001_init.sql`: tables, row-level security, triggers, private `submissions` bucket, realtime
- [x] `migrations/0002_role_guard.sql`: only an admin can change roles
- [x] `migrations/0003_owner_edits.sql`: you can edit anything from the dashboard; deleting a reviewer keeps their feedback

To make an account admin: Table Editor → `profiles` → set `role` to `admin` (works after 0003).

## 2. Hosting (Cloudflare Pages)
1. Workers & Pages → Create → Pages → Connect to Git → pick the private `daaduna` repo.
2. Build command `npm run build`, output directory `dist`.
3. Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (same values as `.env.local`), `NODE_VERSION` = `22`.
4. The build reads the published word subset in `content/vocab/alsaid-published.json` and the committed audio clips;
   the private spreadsheet and the macOS voice are not needed on the build server.

## 3. Supabase Auth → URL Configuration
- Site URL: your Pages address (e.g. `https://daaduna.pages.dev`, later your domain).
- Redirect URLs: `https://<your-address>/reset-password` and `http://localhost:5173/reset-password`.

## 4. Email (domain + Resend)
1. Buy a domain (Cloudflare Registrar is at-cost) and create a Resend account; add the domain in Resend and add
   its DNS records (SPF, DKIM) in Cloudflare.
2. Supabase → Authentication → SMTP Settings: host `smtp.resend.com`, port `465`, user `resend`,
   password = a Resend API key, sender `hello@<your domain>`. Sign-up and password-reset emails now come from you.
3. Edge Function: Supabase → Edge Functions → Deploy a new function → name `send-email` → paste
   `functions/send-email/index.ts`. Secrets (Edge Functions → Secrets): `RESEND_API_KEY`,
   `EMAIL_FROM` (`Daaduna <hello@<your domain>>`), `APP_URL` (your site address).
4. Database → Webhooks → Create: table `email_outbox`, event `Insert`, type Supabase Edge Functions → `send-email`.
5. Then turn on Authentication → Sign In / Providers → Email → **Confirm email**.

## 5. Check on real devices
- iPad Safari: Apple Pencil tracing, writing sheet, recording and comparison (the microphone needs HTTPS, so use the Pages address).
- Phone: lesson in Read and Narrated modes.
