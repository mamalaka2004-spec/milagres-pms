# Deploy Guide — Milagres PMS

Production deployment to **Vercel** + **Supabase**.

## Prerequisites

- Supabase project (already provisioned by the team)
- Vercel account connected to GitHub
- Domain (optional)
- OpenAI API key
- GeckoAPI token (optional, for Airbnb listing import)

## Pre-deploy checklist

1. **All migrations applied** in Supabase SQL Editor (in order):
   - `001_full_schema.sql` (20 tables, seed data, triggers)
   - `002_storage_buckets.sql` (`property-images` bucket + policies)
   - `003_channel_sync.sql` (iCal columns, blocked_dates external tracking)
   - **RLS fix** (Sprint 8): `users` table policy must be **self-only** (not the recursive original):
     ```sql
     DROP POLICY IF EXISTS "Users can view company users" ON public.users;
     CREATE POLICY "Users can view themselves" ON public.users
       FOR SELECT USING (id = auth.uid());
     ```

2. **Production build passes locally:**
   ```bash
   npm run build
   ```

3. **Required env vars set in Vercel:**

   | Var | Where to get |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → "anon / publishable key" |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → "service_role / secret key" |
   | `OPENAI_API_KEY` | https://platform.openai.com/api-keys |
   | `NEXT_PUBLIC_APP_URL` | Final domain (e.g. `https://app.milagreshospedagens.com`) |
   | `NEXT_PUBLIC_WHATSAPP_NUMBER` | Phone in international format, no `+` (e.g. `5582999999999`) |
   | `GECKOAPI_TOKEN` (optional) | https://geckoapi.com.br |

## First-time deploy

```bash
# From the project root
git init
git add -A
git commit -m "Initial commit: Milagres PMS Sprints 0-8"

# Push to GitHub (replace with your repo)
gh repo create milagres-pms --private --source=. --remote=origin --push

# Connect to Vercel
vercel link
vercel env pull .env.production.local
vercel --prod
```

After the first deploy, Vercel auto-deploys on each push to `main`.

## Post-deploy

1. **Add Supabase auth redirect URL:**
   Supabase Dashboard → Authentication → URL Configuration → Site URL = your Vercel domain.
   Add `<domain>/api/auth/callback` and `<domain>/login` to redirect URLs.

2. **CORS on Storage** (if needed):
   Supabase Dashboard → Storage → property-images → Public bucket should already work.

3. **Smoke test in production:**
   - `https://<domain>/login` → log in with admin user
   - `https://<domain>/dashboard` → see real data (occupancy, etc.)
   - `https://<domain>/p/<slug>` → public property page renders
   - `https://<domain>/ai-assistant` → AI chat responds

## Architecture notes for production

- **All admin DB writes go via service-role client (`createAdminClient`).** Auth is enforced at the route boundary via `requireAuth`/`requireRole`. The Supabase RLS policies in this codebase don't include `WITH CHECK` clauses for INSERT, so direct authenticated-role writes are blocked by design — service role bypasses this and is the intended path for server-side mutations.
- **Public booking endpoints** (`/api/booking/*`) use service-role too because anonymous users need to create reservations.
- **Cookies are read via `createServerClient`** only inside `lib/auth.ts` to validate the user session. Once `requireAuth` returns the user, all queries use admin.

## Rolling back a deploy

Vercel keeps every deploy. Go to the project → Deployments → previous deploy → "Promote to Production".

## Background jobs (not yet implemented)

- iCal sync currently runs on-demand via the "Sync now" button. To run it nightly:
  - Add a Vercel Cron in `vercel.json`:
    ```json
    "crons": [{ "path": "/api/cron/sync-all-icals", "schedule": "0 4 * * *" }]
    ```
  - Build the route at `src/app/api/cron/sync-all-icals/route.ts` that loops through active properties + calls `syncAllForProperty`.
  - Protect it with `CRON_SECRET` in headers (Vercel sets this automatically).

## Custom domain

Vercel → Project → Settings → Domains → add domain → follow DNS instructions.
After DNS propagates, update `NEXT_PUBLIC_APP_URL` and re-deploy.
