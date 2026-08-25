begin;
grant usage on schema extensions to anon, authenticated, service_role;
set local search_path = public, extensions;
select plan(18);

select hasnt_function('public', 'is_admin', array[]::text[],
  'is_admin is absent from the exposed public schema');
select hasnt_function('public', 'owns_plan', array['uuid'],
  'owns_plan is absent from the exposed public schema');
select has_function('private', 'is_admin', array[]::text[],
  'is_admin exists in the private schema');
select has_function('private', 'owns_session_exercise', array['uuid'],
  'RLS ownership helpers exist in the private schema');

select ok(not has_function_privilege('anon', 'public.handle_new_user()', 'execute'),
  'anon cannot execute handle_new_user');
select ok(not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'),
  'authenticated cannot execute handle_new_user');
select ok(not has_function_privilege('anon', 'public.enforce_plan_activation()', 'execute'),
  'anon cannot execute enforce_plan_activation');
select ok(not has_function_privilege('authenticated', 'public.enforce_plan_activation()', 'execute'),
  'authenticated cannot execute enforce_plan_activation');

select ok(not has_function_privilege('anon', 'public.hook_restrict_signup(jsonb)', 'execute'),
  'anon cannot execute the signup hook');
select ok(not has_function_privilege('authenticated', 'public.hook_restrict_signup(jsonb)', 'execute'),
  'authenticated cannot execute the signup hook');
select ok(has_function_privilege('supabase_auth_admin', 'public.hook_restrict_signup(jsonb)', 'execute'),
  'supabase_auth_admin can execute the signup hook');
select ok(has_function_privilege('authenticated', 'private.is_admin()', 'execute'),
  'authenticated can evaluate private admin RLS policies');
select ok(not has_function_privilege('anon', 'private.is_admin()', 'execute'),
  'anon cannot execute private RLS helpers');

insert into public.allowed_signup_emails(email, display_name, default_role)
values ('hook-allowed@example.test', 'Hook Allowed', 'member')
on conflict do nothing;

select is(
  public.hook_restrict_signup(
    '{"user":{"email":"hook-allowed@example.test"}}'::jsonb
  ),
  '{}'::jsonb,
  'Before User Created Hook accepts an allowed email'
);
select is(
  (
    public.hook_restrict_signup(
      '{"user":{"email":"hook-denied@example.test"}}'::jsonb
    ) #>> '{error,http_code}'
  )::integer,
  403,
  'Before User Created Hook rejects a non-allowed email with 403'
);

select is(
  (
    select count(*)::integer
    from pg_proc function
    join pg_namespace schema on schema.oid = function.pronamespace
    where function.prosecdef
      and schema.nspname in ('public', 'private')
      and not coalesce(function.proconfig, '{}'::text[]) @> array['search_path=""']
  ),
  0,
  'every application SECURITY DEFINER function has an empty search_path'
);
select is(
  (
    select count(*)::integer
    from pg_proc function
    join pg_namespace schema on schema.oid = function.pronamespace
    where function.prosecdef
      and schema.nspname = 'public'
      and has_function_privilege('anon', function.oid, 'execute')
  ),
  0,
  'anon cannot execute any public SECURITY DEFINER function'
);
select is(
  (
    select count(*)::integer
    from pg_proc function
    join pg_namespace schema on schema.oid = function.pronamespace
    where function.prosecdef
      and schema.nspname = 'public'
      and has_function_privilege('authenticated', function.oid, 'execute')
  ),
  0,
  'authenticated cannot execute any public SECURITY DEFINER function'
);

select * from finish();
rollback;
