begin;
grant usage on schema extensions to anon, authenticated, service_role;
set local search_path = public, extensions;
select plan(23);

select has_column('public', 'exercises', 'environment_profile',
  'exercise environment is normalized');
select has_column('public', 'exercises', 'gym_equipment_tier',
  'exercise equipment tier is normalized');
select has_column('public', 'exercises', 'technical_complexity',
  'exercise complexity is normalized');
select has_column('public', 'exercises', 'goal_suitability',
  'exercise goal suitability is normalized');
select has_column('public', 'training_preferences', 'workout_style',
  'training style is persisted');
select is((select count(*)::integer from public.exercises
  where environment_profile is null or gym_equipment_tier is null
    or technical_complexity is null or cardinality(goal_suitability) = 0),
  0, 'every catalog exercise has complete gym metadata');
select is((select environment_profile from public.exercises
  where slug = 'machine-chest-press'), 'commercial_machine',
  'machine chest press is a commercial machine');
select is((select environment_profile from public.exercises
  where slug = 'seated-row'), 'commercial_cable',
  'seated row is a commercial cable exercise');
select is((select gym_equipment_tier from public.exercises
  where slug = 'barbell-back-squat'), 2::smallint,
  'barbell back squat is standard free-weight tier');
select is((select gym_equipment_tier from public.exercises
  where slug = 'pull-up'), 3::smallint,
  'pull-up remains a bodyweight tier exercise');
select is((select environment_profile from public.exercises
  where slug = 'treadmill'), 'cardio_machine',
  'treadmill is normalized as a cardio machine');

insert into public.allowed_signup_emails(email, display_name, default_role)
values ('v215-owner@example.test', 'V215 Owner', 'member') on conflict do nothing;
insert into auth.users(
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
) values (
  '21500000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000', 'authenticated',
  'authenticated', 'v215-owner@example.test', 'x', now(), now(), now()
);
insert into public.training_preferences(
  user_id, sessions_per_week, session_minutes, cardio_preference,
  experience, training_location, gym_profile
) values (
  '21500000-0000-0000-0000-000000000001', 3, 60, 2,
  'returning', 'full_gym', 'STANDARD_COMMERCIAL_GYM'
);
insert into public.user_goals(user_id, goal_code, priority, active)
values ('21500000-0000-0000-0000-000000000001', 'muscle_gain', 1, true);

select is((select workout_style from public.training_preferences
  where user_id = '21500000-0000-0000-0000-000000000001'), 'gym_first',
  'standard commercial gym defaults to gym-first');
select cmp_ok(
  private.exercise_gym_preference_score_v215(
    '21500000-0000-0000-0000-000000000001',
    (select id from public.exercises where slug = 'lat-pulldown'), 'muscle_gain'
  ), '>',
  private.exercise_gym_preference_score_v215(
    '21500000-0000-0000-0000-000000000001',
    (select id from public.exercises where slug = 'pull-up'), 'muscle_gain'
  ), 'machine vertical pull outranks pull-up for gym-first muscle gain');
select cmp_ok(
  private.exercise_gym_preference_score_v215(
    '21500000-0000-0000-0000-000000000001',
    (select id from public.exercises where slug = 'barbell-back-squat'), 'strength'
  ), '>',
  private.exercise_gym_preference_score_v215(
    '21500000-0000-0000-0000-000000000001',
    (select id from public.exercises where slug = 'hack-squat'), 'strength'
  ), 'strength gives free weights a larger equipment bias');
select ok(
  has_function_privilege('authenticated', 'public.get_auto_plan_catalog_v215()', 'execute')
  and has_function_privilege('authenticated',
    'public.save_training_preferences_v215(text,smallint,smallint,smallint,text,text)', 'execute')
  and has_function_privilege('authenticated',
    'public.create_plan_preview_v215(jsonb,text,jsonb)', 'execute')
  and has_function_privilege('authenticated', 'public.activate_plan_v215(uuid)', 'execute'),
  'authenticated can use ownership-scoped v2.1.5 generator RPCs');
select ok(
  not has_function_privilege('anon', 'public.get_auto_plan_catalog_v215()', 'execute')
  and not has_function_privilege('service_role', 'public.create_plan_preview_v215(jsonb,text,jsonb)', 'execute'),
  'anon and service role do not gain v2.1.5 user RPC access');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"21500000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok($$select public.save_training_preferences_v215(
  'muscle_gain', 3::smallint, 60::smallint, 2::smallint,
  'STANDARD_COMMERCIAL_GYM', 'mixed'
)$$, 'workout style saves atomically');
reset role;
select is((select workout_style from public.training_preferences
  where user_id = '21500000-0000-0000-0000-000000000001'), 'mixed',
  'explicit mixed style persists');
update public.training_preferences set workout_style = 'gym_first'
where user_id = '21500000-0000-0000-0000-000000000001';

insert into public.workout_plans(
  id, user_id, name, status, source, sessions_per_week,
  target_session_minutes, generator_version, goal_code
) values (
  '21500000-0000-0000-0000-000000000002',
  '21500000-0000-0000-0000-000000000001', 'Gym first preview',
  'draft', 'generated', 3, 60, 'v2.1.5', 'muscle_gain'
);
insert into public.workout_days(id, workout_plan_id, name, position, estimated_minutes)
values
  ('21500000-0000-0000-0000-000000000011','21500000-0000-0000-0000-000000000002','A',1,60),
  ('21500000-0000-0000-0000-000000000012','21500000-0000-0000-0000-000000000002','B',2,60),
  ('21500000-0000-0000-0000-000000000013','21500000-0000-0000-0000-000000000002','C',3,60);
with selected(slug, position) as (values
  ('leg-press',1),('machine-row',2),('machine-chest-press',3),
  ('lying-leg-curl',4),('machine-shoulder-press',5),('lat-pulldown',6),
  ('hack-squat',7),('seated-row',8),('incline-machine-press',9),
  ('seated-leg-curl',10),('face-pull',11),('neutral-pulldown',12),
  ('smith-squat',13),('leg-extension',14),('machine-fly',15),
  ('machine-glute',16),('pallof-press',17),('supinated-pulldown',18)
)
insert into public.workout_day_exercises(
  workout_day_id, exercise_id, position, target_sets, rep_min, rep_max, rest_seconds
)
select case when selected.position <= 6 then '21500000-0000-0000-0000-000000000011'::uuid
    when selected.position <= 12 then '21500000-0000-0000-0000-000000000012'::uuid
    else '21500000-0000-0000-0000-000000000013'::uuid end,
  exercise.id, ((selected.position - 1) % 6) + 1, 4, 8, 12, 90
from selected join public.exercises exercise on exercise.slug = selected.slug;

select is(private.calculate_gym_first_quality_v215(
  '21500000-0000-0000-0000-000000000002') ->> 'status', 'PASS',
  'commercial muscle-gain composition passes the gym-first gate');
select cmp_ok((private.calculate_gym_first_quality_v215(
  '21500000-0000-0000-0000-000000000002') ->> 'gymEquipmentPercent')::numeric,
  '>=', 70::numeric, 'gym equipment percentage meets the hard target');
select cmp_ok((private.calculate_gym_first_quality_v215(
  '21500000-0000-0000-0000-000000000002') ->> 'bodyweightPercent')::numeric,
  '<=', 20::numeric, 'bodyweight percentage stays within the hard target');
select cmp_ok((private.calculate_gym_first_quality_v215(
  '21500000-0000-0000-0000-000000000002') ->> 'corePostureSlots')::integer,
  '<=', 2, 'core and posture do not dominate primary slots');
select is((select count(*)::integer from public.workout_plans
  where user_id = '21500000-0000-0000-0000-000000000001' and status = 'active'),
  0, 'a v2.1.5 preview does not silently activate a plan');

select * from finish();
rollback;
