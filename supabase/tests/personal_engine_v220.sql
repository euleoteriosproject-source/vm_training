begin;
grant usage on schema extensions to anon, authenticated, service_role;
set local search_path = public, extensions;
select plan(20);

select has_column('public', 'exercises', 'exercise_family', 'exercise family is persisted');
select has_column('public', 'exercises', 'fatigue_profile', 'fatigue profile is persisted');
select has_column('public', 'exercises', 'stability_profile', 'stability profile is persisted');
select has_column('public', 'workout_days', 'programming_focus', 'day programming focus is persisted');
select has_column('public', 'workout_day_exercises', 'slot_role', 'plan slot role is persisted');
select has_column('public', 'workout_day_exercises', 'selection_rationale', 'selection rationale is persisted');
select has_column('public', 'workout_day_exercises', 'progression_recommendation', 'progression recommendation is persisted');
select has_column('public', 'workout_session_exercises', 'slot_role', 'session snapshots slot role');
select has_column('public', 'workout_session_exercises', 'exercise_family', 'session snapshots exercise family');

select is((select count(*)::integer from public.exercises
  where exercise_family is null or fatigue_profile is null or stability_profile is null),
  0, 'all existing catalog rows received complete programming metadata');
select is((select count(*)::integer from public.exercises
  where fatigue_profile not in ('low','medium','high')), 0, 'fatigue taxonomy is constrained');
select is((select count(*)::integer from public.exercises
  where stability_profile not in ('low','moderate','high')), 0, 'stability taxonomy is constrained');

select has_function('public', 'get_auto_plan_catalog_v220', array[]::text[], 'v2.2 catalog RPC exists');
select has_function('public', 'create_plan_preview_v220', array['jsonb','text','jsonb'], 'v2.2 preview RPC exists');
select has_function('public', 'activate_plan_v220', array['uuid'], 'v2.2 activation RPC exists');
select ok(
  has_function_privilege('authenticated', 'public.get_auto_plan_catalog_v220()', 'execute')
  and has_function_privilege('authenticated', 'public.create_plan_preview_v220(jsonb,text,jsonb)', 'execute')
  and has_function_privilege('authenticated', 'public.activate_plan_v220(uuid)', 'execute'),
  'authenticated users can use the ownership-scoped v2.2 RPCs');
select ok(
  not has_function_privilege('anon', 'public.get_auto_plan_catalog_v220()', 'execute')
  and not has_function_privilege('service_role', 'public.create_plan_preview_v220(jsonb,text,jsonb)', 'execute'),
  'anon and service role do not gain v2.2 user RPC access');

insert into public.allowed_signup_emails(email, display_name, default_role)
values ('v220-owner@example.test', 'V220 Owner', 'member') on conflict do nothing;
insert into auth.users(
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
) values (
  '22000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000', 'authenticated',
  'authenticated', 'v220-owner@example.test', 'x', now(), now(), now()
);
insert into public.workout_plans(
  id, user_id, name, status, source, sessions_per_week,
  target_session_minutes, generator_version, goal_code, generation_rationale
) values (
  '22000000-0000-0000-0000-000000000002',
  '22000000-0000-0000-0000-000000000001', 'Personal engine preview',
  'draft', 'generated', 2, 30, 'v2.2.0', 'muscle_gain', '{}'::jsonb
);
insert into public.workout_days(
  id, workout_plan_id, name, position, estimated_minutes, programming_focus
) values (
  '22000000-0000-0000-0000-000000000003',
  '22000000-0000-0000-0000-000000000002', 'Corpo inteiro A', 1, 30,
  'Movimentos prioritários antes de acessórios.'
);
insert into public.workout_day_exercises(
  id, workout_day_id, exercise_id, position, target_sets, rep_min, rep_max,
  rest_seconds, slot_role, exercise_family, selection_rationale,
  progression_recommendation
) select
  '22000000-0000-0000-0000-000000000004',
  '22000000-0000-0000-0000-000000000003', id, 1, 4, 8, 12, 90,
  'PRIMARY_LOWER', exercise_family, 'Atende o slot primário inferior.',
  '{"state":"INSUFFICIENT_DATA"}'::jsonb
from public.exercises where slug = 'leg-press';
insert into public.workout_sessions(
  id, user_id, workout_day_id, workout_plan_id, status
) values (
  '22000000-0000-0000-0000-000000000005',
  '22000000-0000-0000-0000-000000000001',
  '22000000-0000-0000-0000-000000000003',
  '22000000-0000-0000-0000-000000000002', 'in_progress'
);
insert into public.workout_session_exercises(
  id, workout_session_id, planned_exercise_id, actual_exercise_id, position
) select
  '22000000-0000-0000-0000-000000000006',
  '22000000-0000-0000-0000-000000000005', id, id, 1
from public.exercises where slug = 'leg-press';

select is((select slot_role from public.workout_session_exercises
  where id = '22000000-0000-0000-0000-000000000006'), 'PRIMARY_LOWER',
  'session creation snapshots the programmed slot role');
select is((select selection_rationale from public.workout_session_exercises
  where id = '22000000-0000-0000-0000-000000000006'),
  'Atende o slot primário inferior.', 'session creation snapshots the selection reason');
select is((select progression_recommendation->>'state' from public.workout_session_exercises
  where id = '22000000-0000-0000-0000-000000000006'),
  'INSUFFICIENT_DATA', 'session creation snapshots conservative progression state');

select * from finish();
rollback;
