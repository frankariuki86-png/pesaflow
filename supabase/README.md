# PesaFlow Supabase Setup

This repository uses Supabase as the primary backend for the web and mobile apps. The schema, migrations, and security policies should be managed in this folder instead of relying on a missing backend service.

## Project structure

- `schema.sql` contains the legacy MVP schema snapshot.
- `migrations/` contains versioned SQL for safe incremental changes.
- `seed.sql` contains optional seed data for local development.
- `functions/` is reserved for Supabase Edge Functions such as M-Pesa callbacks and reporting jobs.

## Environment files

Create a local environment file for each app without committing secrets:

```env
# packages/web/.env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

```env
# packages/mobile/.env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Migration workflow

1. Create a new migration in `supabase/migrations/`.
2. Use numeric sequential names such as `001_initial_schema.sql`.
3. Keep migrations idempotent where practical with `create table if not exists` and `drop policy if exists` patterns.
4. Run migrations in the Supabase SQL editor or via the Supabase CLI.
5. Add seed data only for non-production development environments.

## Security rules

- Never commit `SUPABASE_SERVICE_ROLE_KEY`, database passwords, or M-Pesa secrets.
- Keep all secret credentials in Supabase Edge Functions or server-side environment variables.
- Protect sensitive data with Row Level Security and membership-based authorization.
- Avoid exposing raw database errors in the UI.

## Local setup

1. Create a Supabase project.
2. Enable Email auth.
3. Apply the migrations in order.
4. Copy the project URL and anon key into the app environment files.
5. Start the web app with `npm --prefix packages/web run dev` and the mobile app with `npm --prefix packages/mobile run start`.
