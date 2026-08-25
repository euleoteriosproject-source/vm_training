-- Passwordless Hosted CLI test sessions use this Supabase-managed backend
-- role. No browser/API role receives persistent access.
grant usage on schema extensions to cli_login_postgres with grant option;
