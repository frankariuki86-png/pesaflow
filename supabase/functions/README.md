# Supabase Edge Functions

This folder is reserved for secure server-side business logic such as M-Pesa callbacks, payment verification, notifications, and reporting jobs.

Suggested folders:

- mpesa/
- mpesa-callback/
- notifications/
- reports/

Keep all secrets in Supabase Edge Function environment variables and never expose them in the web or mobile clients.
