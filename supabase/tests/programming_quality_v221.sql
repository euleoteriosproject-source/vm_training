begin;
grant usage on schema extensions to anon, authenticated, service_role;
set local search_path = public, extensions;
select plan(13);

select has_function('private', 'calculate_goal_alignment_v221', array['uuid'],
  'v2.2.1 has an independent goal-alignment calculator');
select has_function('private', 'assert_plan_quality_v221', array['uuid'],
  'v2.2.1 has an independent quality assertion');
select has_function('private', 'create_plan_preview_v221', array['uuid','jsonb','text','jsonb'],
  'v2.2.1 private preview implementation exists');
select has_function('public', 'create_plan_preview_v221', array['jsonb','text','jsonb'],
  'v2.2.1 owner preview RPC exists');
select has_function('public', 'activate_plan_v221', array['uuid'],
  'v2.2.1 explicit activation RPC exists');
select ok(
  has_function_privilege('authenticated', 'public.create_plan_preview_v221(jsonb,text,jsonb)', 'execute')
  and has_function_privilege('authenticated', 'public.activate_plan_v221(uuid)', 'execute'),
  'authenticated can execute only the owner-scoped v2.2.1 workflow'
);
select ok(
  not has_function_privilege('anon', 'public.create_plan_preview_v221(jsonb,text,jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.activate_plan_v221(uuid)', 'execute'),
  'anon cannot execute v2.2.1 plan writes'
);
select ok(
  not has_function_privilege('service_role', 'public.create_plan_preview_v221(jsonb,text,jsonb)', 'execute')
  and not has_function_privilege('service_role', 'public.activate_plan_v221(uuid)', 'execute'),
  'service role does not gain user-plan RPC access'
);
select ok(
  not has_function_privilege('authenticated', 'private.assert_plan_quality_v221(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'private.create_plan_preview_v221(uuid,jsonb,text,jsonb)', 'execute'),
  'private v2.2.1 implementation is not directly callable by authenticated users'
);
select ok(
  has_function_privilege('authenticated', 'public.create_plan_preview_v220(jsonb,text,jsonb)', 'execute')
  and has_function_privilege('authenticated', 'public.activate_plan_v220(uuid)', 'execute'),
  'the v2.2.0 compatibility workflow remains available'
);

insert into public.allowed_signup_emails(email, display_name, default_role)
values ('v221-goal@example.test', 'V221 Goal', 'member') on conflict do nothing;
insert into auth.users(
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
) values (
  '22100000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000', 'authenticated',
  'authenticated', 'v221-goal@example.test', 'x', now(), now(), now()
);
insert into public.workout_plans(
  id, user_id, name, status, source, sessions_per_week,
  target_session_minutes, generator_version, goal_code
) values (
  '22100000-0000-0000-0000-000000000002',
  '22100000-0000-0000-0000-000000000001', 'V221 posture audit',
  'draft', 'generated', 3, 60, 'v2.2.1', 'posture'
);
insert into public.workout_days(id, workout_plan_id, name, position, estimated_minutes)
values
  ('22100000-0000-0000-0000-000000000011', '22100000-0000-0000-0000-000000000002', 'A', 1, 38),
  ('22100000-0000-0000-0000-000000000012', '22100000-0000-0000-0000-000000000002', 'B', 2, 38),
  ('22100000-0000-0000-0000-000000000013', '22100000-0000-0000-0000-000000000002', 'C', 3, 38);
insert into public.workout_day_exercises(
  workout_day_id, exercise_id, position, target_sets, rep_min, rep_max,
  rest_seconds
)
select day.id, exercise.id, chosen.position, 3, 8, 12, 90
from public.workout_days day
cross join (values
  ('seated-row', 1), ('lat-pulldown', 2), ('leg-press', 3)
) chosen(slug, position)
join public.exercises exercise on exercise.slug = chosen.slug
where day.workout_plan_id = '22100000-0000-0000-0000-000000000002';

select is(
  private.calculate_goal_alignment_v221('22100000-0000-0000-0000-000000000002')->>'status',
  'PASS',
  'posture accepts functional pulling plus a strength foundation without mandatory corrective filler'
);
select is(
  private.calculate_goal_alignment_v221('22100000-0000-0000-0000-000000000002')->>'strengthSlots',
  '9',
  'goal alignment reports the persisted resistance foundation'
);

delete from public.workout_day_exercises item
using public.exercises exercise
where item.exercise_id = exercise.id
  and exercise.slug in ('seated-row', 'lat-pulldown')
  and item.workout_day_id in (
    select day.id from public.workout_days day
    where day.workout_plan_id = '22100000-0000-0000-0000-000000000002'
  );
select is(
  private.calculate_goal_alignment_v221('22100000-0000-0000-0000-000000000002')->>'status',
  'FAIL',
  'posture fails when functional coverage and the strength foundation are removed'
);

select * from finish();
rollback;
