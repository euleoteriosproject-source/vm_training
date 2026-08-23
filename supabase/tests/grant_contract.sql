-- Canonical ACL contract established by R3 and extended by v1.8.
begin;
select plan(30);

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
select is(
  (select count(*)::integer from information_schema.role_table_grants
   where table_schema = 'public'
     and grantee in ('anon', 'authenticated', 'service_role', 'supabase_auth_admin')),
  99,
  'canonical public table ACL has exactly 99 grants'
);
select is(
  (select count(*)::integer from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'authenticated'),
  68,
  'authenticated has exactly 68 required table grants'
);
select is(
  (select count(*)::integer from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'service_role'),
  30,
  'service_role has exactly 30 required table grants'
);
select is(
  (select count(*)::integer from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'supabase_auth_admin'),
  1,
  'Auth Hook role has only its allowlist table grant'
);
select is(
  (select count(*)::integer
   from pg_class object
   join pg_namespace schema on schema.oid = object.relnamespace
   cross join (values ('anon'), ('authenticated'), ('service_role')) roles(role_name)
   cross join (values ('USAGE'), ('SELECT'), ('UPDATE')) privileges(privilege)
   where object.relkind = 'S' and schema.nspname in ('public', 'private')
     and has_sequence_privilege(roles.role_name, object.oid, privileges.privilege)),
  0,
  'Data API roles have no application sequence grants'
);
select ok(has_schema_privilege('authenticated', 'private', 'usage'),
  'authenticated can execute private RLS helpers');
select is(
  (select count(*)::integer
   from (values ('anon'), ('service_role'), ('supabase_auth_admin')) roles(role_name)
   where has_schema_privilege(roles.role_name, 'private', 'usage')
      or has_schema_privilege(roles.role_name, 'private', 'create')),
  1,
  'only service_role additionally receives private schema usage for media automation'
);
select is(
  (select count(*)::integer
   from (values ('anon'), ('authenticated'), ('service_role'), ('supabase_auth_admin')) roles(role_name)
   where has_schema_privilege(roles.role_name, 'public', 'create')),
  0,
  'Data API and Auth Hook roles cannot create in public'
);
select is(
  (select count(*)::integer
   from pg_proc function
   join pg_namespace schema on schema.oid = function.pronamespace
   cross join (values ('anon'), ('authenticated'), ('service_role'), ('supabase_auth_admin')) roles(role_name)
   where schema.nspname in ('public', 'private')
     and has_function_privilege(roles.role_name, function.oid, 'execute')),
  28,
  'canonical function ACL has exactly 28 grants'
);

select ok(has_table_privilege('authenticated', 'public.gym_equipment_presets', 'select'),
  'authenticated can read gym presets');
select ok(has_table_privilege('authenticated', 'public.user_movement_attention', 'select,insert,update,delete'),
  'authenticated can manage own movement attention through RLS');
select ok(has_table_privilege('authenticated', 'public.workout_substitution_events', 'select'),
  'authenticated can read own substitution audit events');
select ok(not has_table_privilege('authenticated', 'public.workout_substitution_events', 'insert'),
  'authenticated cannot insert substitution audit events directly');
select ok(has_table_privilege('service_role', 'public.gym_equipment_presets', 'select,insert,update,delete'),
  'service_role can manage gym presets');
select ok(has_table_privilege('service_role', 'public.user_movement_attention', 'select,insert,update,delete'),
  'service_role can manage movement attention operationally');
select ok(has_table_privilege('service_role', 'public.workout_substitution_events', 'select,insert,update,delete'),
  'service_role can manage substitution audit events operationally');
select ok(
  has_function_privilege('authenticated', 'public.substitute_workout_exercise(uuid,text,uuid,uuid[])', 'execute')
  and has_function_privilege('authenticated', 'public.undo_workout_substitution(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.finish_workout(uuid,text,boolean)', 'execute')
  and has_function_privilege('authenticated', 'public.cancel_workout(uuid,text)', 'execute'),
  'authenticated can execute the ownership-checked workout RPCs'
);

select * from finish();
rollback;
