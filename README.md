# My Tutor — MTH 541 Statistical Theory II

A self-study app for Amen's MTH 541/643 course, built on the same architecture as the Calc 2 tutor app, re-themed and repopulated for Statistical Theory II.

## 1. Run it locally

```bash
npm install
npm run dev
```

## 2. One-time Supabase setup

Create a Supabase project, then run this in the SQL editor:

```sql
create table tutor_state (
  id text primary key,
  payload jsonb,
  updated_at timestamptz default now()
);
alter table tutor_state enable row level security;
create policy "anon read/write" on tutor_state for all using (true) with check (true);
```

Then open `src/StatTutorApp.jsx` and replace these two lines near the top with your real project's values (Project Settings → API in Supabase):

```js
const SUPABASE_URL = "YOUR_SUPABASE_URL_HERE";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY_HERE";
```

## 3. Deploy to Netlify

Push to GitHub, then in Netlify: "Add a new site" → "Import an existing project" → pick the repo. `netlify.toml` is already set up (build command `npm run build`, publish directory `dist`) — no manual config needed.

## 4. What's real right now vs. what's still queued up

**Fully built, from your actual lecture notes, every step shown:**
- Session 6 — Method of Moments
- Session 7 — Maximum Likelihood Estimation
- Session 8 — Sufficient Statistics & Factorization Theorem
- Session 9 — Exponential Family of Distributions

**Solid conceptual content, lighter on practice problems (foundational review):**
- Sessions 1–5 — random variables/CDF, joint distributions, moments/MGFs/common distributions, Gamma/Beta, exponential/inequalities/CLT

**Not yet built — honestly marked as such in the app, not faked:**
- Sessions 10–16 — Chi-square/t-distributions, sampling distributions, confidence intervals, Fisher Information, estimator evaluation, hypothesis testing, F-distribution. These populate the same way the first four did: real lecture notes in, real content out.

## 5. Dates used

- **Test 1: October 3, 2026 (estimated — "first week of October," not yet confirmed).** Update `TEST1_DATE` in `StatTutorApp.jsx` once you have a real date.
- **Final Exam: December 9, 2026, 8:45–10:45am** — confirmed from the syllabus.

## 6. Backups

Progress (`hw-state`, `tasks`, session position, theme/settings) lives in the `tutor_state` table under keys prefixed `Amen:`. No automated backup script is wired up yet in this version (the Calc 2 app has one, `backup.js` + a GitHub Actions workflow, if you want the same thing here — just ask).
