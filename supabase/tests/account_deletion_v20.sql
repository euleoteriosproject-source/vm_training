begin;
grant usage on schema extensions to anon, authenticated, service_role;
set local search_path = public, extensions;
select plan(8);

select has_function('private', 'delete_current_auth_user', array[]::text[],
  'private account-deletion helper exists');
select is(
  (select prosecdef from pg_proc where oid = 'private.delete_current_auth_user()'::regprocedure),
  true,
  'private helper is SECURITY DEFINER'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.delete_own_account_data()'::regprocedure),
  false,
  'public account-deletion RPC remains SECURITY INVOKER'
);
select ok(
  has_function_privilege('authenticated', 'public.delete_own_account_data()', 'execute')
  and not has_function_privilege('anon', 'public.delete_own_account_data()', 'execute'),
  'only authenticated users can call the public RPC'
);

insert into public.allowed_signup_emails(email, display_name, default_role)
values ('delete-self-v20@example.test', 'Delete Self', 'member')
on conflict do nothing;
insert into auth.users(
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
) values (
  'd1000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'delete-self-v20@example.test', 'x',
  now(), now(), now()
);

select is(
  (select count(*)::integer from public.profiles
   where user_id = 'd1000000-0000-0000-0000-000000000001'),
  1,
  'fixture profile exists before deletion'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
select lives_ok(
  $$select public.delete_own_account_data()$$,
  'authenticated user can delete only the current account'
);
reset role;

select is(
  (select count(*)::integer from auth.users
   where id = 'd1000000-0000-0000-0000-000000000001'),
  0,
  'auth user is deleted'
);
select is(
  (select count(*)::integer from public.profiles
   where user_id = 'd1000000-0000-0000-0000-000000000001'),
  0,
  'profile is removed by cascade'
);

select * from finish();
rollback;
