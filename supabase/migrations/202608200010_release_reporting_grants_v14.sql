-- Server-only release reporting may verify the active production allowlist.
grant select on public.allowed_signup_emails to service_role;
