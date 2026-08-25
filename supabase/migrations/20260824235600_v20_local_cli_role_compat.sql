-- The Hosted project owns this managed CLI role, while the local Supabase
-- stack does not define it. Create a no-login compatibility role locally so
-- the following least-privilege grant migration can replay unchanged.
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = 'cli_login_postgres'
  ) then
    create role cli_login_postgres nologin;
  end if;
end;
$$;
