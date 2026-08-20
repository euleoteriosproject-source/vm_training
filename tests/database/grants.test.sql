-- Run after applying the R2 proposal to the local simulation.
begin;
select plan(13);

select is(
  (select count(*)::integer from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'anon'),
  0,
  'anon has no direct application table privileges'
);
select is(
  (select count(*)::integer from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'authenticated'
     and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')),
  0,
  'authenticated has no TRUNCATE, TRIGGER, or REFERENCES privileges'
);
select is(
  (select count(*)::integer from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'service_role'
     and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')),
  0,
  'service_role has no TRUNCATE, TRIGGER, or REFERENCES privileges'
);
select ok(has_table_privilege('authenticated', 'public.profiles', 'select'),
  'authenticated can read own profile through RLS');
select ok(has_table_privilege('authenticated', 'public.profiles', 'update'),
  'authenticated can update own profile through RLS');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'delete'),
  'authenticated cannot delete profiles directly');
select ok(has_table_privilege('service_role', 'public.exercise_media', 'insert,update,delete'),
  'service_role retains media processing privileges');
select ok(not has_function_privilege('authenticated', 'public.publish_exercise_media(uuid,uuid)', 'execute'),
  'authenticated cannot execute the server-only media publisher');
select ok(has_function_privilege('service_role', 'public.publish_exercise_media(uuid,uuid)', 'execute'),
  'service_role can execute the media publisher');
select ok(not has_function_privilege('anon', 'public.hook_restrict_signup(jsonb)', 'execute'),
  'anon cannot execute the Auth Hook');
select ok(not has_function_privilege('authenticated', 'public.hook_restrict_signup(jsonb)', 'execute'),
  'authenticated cannot execute the Auth Hook');
select ok(has_function_privilege('supabase_auth_admin', 'public.hook_restrict_signup(jsonb)', 'execute'),
  'supabase_auth_admin can execute the Auth Hook');
select is(
  (select count(*)::integer
   from pg_default_acl defaults
   join pg_roles owner on owner.oid = defaults.defaclrole
   join pg_namespace schema on schema.oid = defaults.defaclnamespace
   cross join lateral aclexplode(defaults.defaclacl) acl
   left join pg_roles grantee on grantee.oid = acl.grantee
   where owner.rolname = 'postgres' and schema.nspname = 'public'
     and (acl.grantee = 0 or grantee.rolname in ('anon', 'authenticated', 'service_role'))
     and acl.privilege_type in ('DELETE', 'INSERT', 'SELECT', 'UPDATE', 'TRUNCATE', 'TRIGGER', 'REFERENCES', 'MAINTAIN', 'USAGE', 'EXECUTE')),
  0,
  'future postgres/public objects do not inherit Data API privileges'
);

select * from finish();
rollback;
