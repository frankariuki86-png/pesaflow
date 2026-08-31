# PesaFlow Supabase Setup

This folder contains the initial Supabase schema for the MVP.

## Steps

1. Create a Supabase project.
2. Open the Supabase SQL editor.
3. Run the contents of `schema.sql`.
4. In Supabase Auth, enable email sign-in.
5. Add the app URL and redirect URLs for your web app.
6. Copy the project URL and anon key into the web app env file.

## Web env

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Notes

- Keep secrets in the server side only.
- The browser should never receive the service role key.
- Use RLS and policies to protect user data.
- GraphQL is not required; use the Supabase PostgREST API and the JS SDK.

## MVP priority

1. Auth
2. Profiles
3. Transactions
4. Business basics
5. Chama basics
6. Notifications
7. Reports
