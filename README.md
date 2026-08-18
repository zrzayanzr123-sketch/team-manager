# Team Manager — Velora Promotions

A standalone web app (not a Claude artifact) so you can use it on any device, and so you
(or Claude, in future sessions) can keep editing the code without ever touching your saved data.

**How the pieces fit together:**
- The app code (this folder) lives wherever you deploy it — e.g. Netlify.
- Your data (team members + daily records) lives in a separate database — Supabase (free tier).
- Because they're separate, redeploying new code from Claude never touches your existing data,
  and you always see the same data no matter which device you log in from.

## 1. Create your database (Supabase)

1. Go to supabase.com, sign up, and create a new project (pick any name/region, free tier is fine).
2. Once it's ready, open the **SQL Editor** and run:

```sql
create table team_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table team_data enable row level security;

create policy "Users can view own data" on team_data
  for select using (auth.uid() = user_id);

create policy "Users can insert own data" on team_data
  for insert with check (auth.uid() = user_id);

create policy "Users can update own data" on team_data
  for update using (auth.uid() = user_id);
```

3. (Optional but recommended for a one-person account) In **Authentication → Providers → Email**,
   turn off "Confirm email" so you can log in immediately after signing up, since you won't need
   email verification for your own account.
4. In **Project Settings → API**, copy the **Project URL** and the **anon public key** — you'll need both next.

## 2. Connect the app to your database

1. In this project folder, copy `.env.example` to `.env`.
2. Fill in the two values from step 1.4:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

3. Install dependencies and try it locally:

```
npm install
npm run dev
```

4. Open the local URL it gives you, sign up with any email + password, and the app should load with
   you (Zayan) as the only team member.

## 3. Deploy to Netlify

**Easiest path — drag and drop:**
1. `npm run build` — this creates a `dist` folder.
2. Go to app.netlify.com → "Add new site" → "Deploy manually" → drag in the `dist` folder.
3. Go to **Site configuration → Environment variables** and add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` (same values as your `.env`), then trigger a redeploy so the build
   picks them up (drag-and-drop deploys are pre-built, so for env vars to take effect you'll want
   the GitHub method below, or rebuild locally with the vars set and re-drag the `dist` folder).

**Recommended path — connect to GitHub (so future Claude edits redeploy automatically):**
1. Push this folder to a new GitHub repository.
2. In Netlify: "Add new site" → "Import an existing project" → pick the repo.
3. Build command: `npm run build`, publish directory: `dist`.
4. Add the same two environment variables under **Site configuration → Environment variables**.
5. Deploy. From now on, whenever the code in the repo changes (including edits Claude helps you make),
   Netlify rebuilds automatically — your Supabase data is untouched.

## 4. Using it day to day

- Visit your Netlify URL on any device, log in with the same email/password, and you'll see the same data.
- Add your team on the **My Team** page, then track days on **Team Data**.
- To make future changes with Claude: share this project's code, describe the change, redeploy the
  updated code the same way — your Supabase data stays exactly as it is.
