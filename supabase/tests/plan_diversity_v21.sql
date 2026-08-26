begin;
grant usage on schema extensions to anon, authenticated, service_role;
set local search_path = public, extensions;
select plan(21);

select has_view('public', 'exercise_media_readiness',
  'v2.1 exposes canonical media readiness');
select ok(
  has_function_privilege('authenticated', 'public.get_auto_plan_catalog()', 'execute')
  and has_function_privilege('authenticated',
    'public.create_and_activate_plan_v21(jsonb,text,jsonb)', 'execute'),
  'authenticated can use ownership-scoped v2.1 RPCs'
);

insert into public.allowed_signup_emails(email, display_name, default_role)
values ('v21-owner@example.test', 'V21 Owner', 'member') on conflict do nothing;
insert into auth.users(
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
) values (
  'd1000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000', 'authenticated',
  'authenticated', 'v21-owner@example.test', 'x', now(), now(), now()
);
insert into public.training_preferences(
  user_id, sessions_per_week, session_minutes, cardio_preference,
  experience, training_location
) values (
  'd1000000-0000-0000-0000-000000000001', 3, 60, 2,
  'returning', 'full_gym'
);

insert into public.exercises(
  slug, name_pt, category, movement_pattern, primary_muscles,
  difficulty, execution_instructions, active
)
select 'v21-fixture-' || fixture.number, 'Fixture ' || fixture.number,
  'strength', fixture.pattern, array['core'], 'beginner',
  array['Execute com controle.'], false
from unnest(array[
  'squat', 'horizontal_pull', 'knee_flexion', 'vertical_push', 'carry',
  'horizontal_push', 'hinge', 'vertical_pull', 'knee_extension',
  'core_anti_rotation', 'core_anti_extension', 'posture', 'mobility', 'cardio'
]) with ordinality as fixture(pattern, number);

insert into public.exercise_media(
  exercise_id, media_type, storage_path, poster_path, status, media_role,
  source_name, source_type, source_url, original_file_url, license_code,
  license_url, author, attribution_text, content_hash, verified_at,
  reviewed_at, processed_at, execution_quality, review_checklist,
  animation_verified, frame_count, animation_loop, frames_per_second,
  duration_seconds, review_state, review_method, review_agent,
  validation_version, validation_confidence, automated_validation
)
select exercise.id, 'gif',
  'exercises/' || exercise.slug || '/primary/v21.gif',
  'exercises/' || exercise.slug || '/primary/v21.webp',
  'processed', 'PRIMARY_DEMO', 'V21 fixture', 'public_domain',
  'https://example.test/' || exercise.slug,
  'https://example.test/' || exercise.slug || '.webm', 'PD',
  'https://example.test/public-domain', 'V21 fixture', 'Public Domain',
  md5(exercise.slug) || md5(exercise.slug), now(), now(), now(), 'approved',
  '{"correct_exercise":true,"compatible_equipment":true,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":true,"useful_framing":true,"no_blocking_elements":true,"license_confirmed":true}',
  true, 96, true, 12.5, 8, 'AUTOMATED_VALIDATED', 'automated',
  'vm-media-validator-v21-test', '2.1', 'HIGH',
  '{"exercise_match_exact":true,"equipment_match":true,"execution_quality_approved":true,"visibility_sufficient":true,"license_verified":true,"download_permitted":true,"transformation_permitted":true,"rehost_permitted":true,"source_provenance_verified":true,"visual_inspection_passed":true,"biomechanical_references_passed":true,"final_gif_inspection_passed":true,"storage_hash_verified":true}'
from public.exercises exercise where exercise.slug like 'v21-fixture-%';

insert into storage.objects(bucket_id, name, metadata)
select 'exercise-media', media.storage_path, '{"size":1024}'::jsonb
from public.exercise_media media join public.exercises exercise
  on exercise.id = media.exercise_id where exercise.slug like 'v21-fixture-%'
union all
select 'exercise-media', media.poster_path, '{"size":512}'::jsonb
from public.exercise_media media join public.exercises exercise
  on exercise.id = media.exercise_id where exercise.slug like 'v21-fixture-%';

set local role service_role;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"service_role"}', true);
select private.publish_validated_exercise_media_automated(
  media.id, 'vm-media-validator-v21-test', '2.1'
)
from public.exercise_media media join public.exercises exercise
  on exercise.id = media.exercise_id where exercise.slug like 'v21-fixture-%';
reset role;
update public.exercises set active = true where slug like 'v21-fixture-%';

insert into public.exercises(
  slug, name_pt, category, movement_pattern, primary_muscles,
  difficulty, execution_instructions, active
) values (
  'v21-missing-file', 'Fixture sem arquivo', 'strength', 'squat',
  array['quadriceps'], 'beginner', array['Execute com controle.'], true
);

select is((select count(*)::integer from public.exercise_media_readiness
  where slug like 'v21-fixture-%' and media_ready), 14,
  'all complete fixtures are media-ready');
select ok(not public.exercise_has_approved_primary(
  (select id from public.exercises where slug = 'v21-missing-file')),
  'missing media is not ready');
select ok((select active from public.exercises where slug = 'v21-missing-file'),
  'catalog activation is independent from media readiness');

-- Remaining assertions build and atomically promote a plan below.
insert into public.workout_plans(
  id, user_id, name, status, sessions_per_week, target_session_minutes
) values (
  'd2000000-0000-0000-0000-000000000002',
  'd1000000-0000-0000-0000-000000000001', 'Plano anterior', 'draft', 3, 60
);
insert into public.workout_days(
  id, workout_plan_id, name, position, estimated_minutes
) values (
  'd3000000-0000-0000-0000-000000000003',
  'd2000000-0000-0000-0000-000000000002', 'Anterior', 1, 60
);
insert into public.workout_day_exercises(
  workout_day_id, exercise_id, position, target_sets, rep_min, rep_max
)
select 'd3000000-0000-0000-0000-000000000003', exercise.id, 1, 3, 8, 12
from public.exercises exercise where exercise.slug = 'v21-fixture-1';

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok(
  $$select public.activate_plan('d2000000-0000-0000-0000-000000000002')$$,
  'the previous valid plan activates');
reset role;

insert into public.workout_sessions(
  id, user_id, workout_day_id, workout_plan_id, status, completed_at
) values (
  'd4000000-0000-0000-0000-000000000004',
  'd1000000-0000-0000-0000-000000000001',
  'd3000000-0000-0000-0000-000000000003',
  'd2000000-0000-0000-0000-000000000002', 'completed', now()
);

select set_config('v21.days', jsonb_build_array(
  jsonb_build_object('name', 'Full Body A', 'estimatedMinutes', 60,
    'exercises', (select jsonb_agg(jsonb_build_object(
      'exerciseId', exercise.id, 'sets', 3, 'repMin', 8, 'repMax', 12,
      'restSeconds', 75) order by fixture.number)
    from unnest(array[1,2,3,4,5,6]) fixture(number)
    join public.exercises exercise on exercise.slug = 'v21-fixture-' || fixture.number)),
  jsonb_build_object('name', 'Full Body B', 'estimatedMinutes', 60,
    'exercises', (select jsonb_agg(jsonb_build_object(
      'exerciseId', exercise.id, 'sets', 3, 'repMin', 8, 'repMax', 12,
      'restSeconds', 75) order by fixture.number)
    from unnest(array[1,2,7,8,9,10]) fixture(number)
    join public.exercises exercise on exercise.slug = 'v21-fixture-' || fixture.number)),
  jsonb_build_object('name', 'Full Body C', 'estimatedMinutes', 60,
    'exercises', (select jsonb_agg(jsonb_build_object(
      'exerciseId', exercise.id, 'sets', 3, 'repMin', 8, 'repMax', 12,
      'restSeconds', 75) order by fixture.number)
    from unnest(array[3,4,11,12,13,14]) fixture(number)
    join public.exercises exercise on exercise.slug = 'v21-fixture-' || fixture.number))
)::text, true);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select count(*)::integer from public.get_auto_plan_catalog()
  where auto_plan_eligible and id in (
    select id from public.exercises where slug like 'v21-fixture-%'
  )), 14, 'centralized catalog exposes all eligible fixtures');
select ok(not public.is_auto_plan_eligible(
  (select id from public.exercises where slug = 'v21-missing-file')),
  'active no-media exercise is excluded from auto plans');
select lives_ok($$select set_config('v21.result',
  public.create_and_activate_plan_v21(
    current_setting('v21.days')::jsonb, 'v2.1.0',
    '{"strategy":"pgTAP-v21"}'::jsonb
  )::text, true)$$,
  'v2.1 creates and promotes a diverse plan atomically');
reset role;

select is((select status from public.workout_plans
  where id = 'd2000000-0000-0000-0000-000000000002'), 'archived',
  'previous active plan is archived');
select is((select status from public.workout_plans
  where id = (current_setting('v21.result')::jsonb->>'planId')::uuid), 'active',
  'new plan is active');
select is((select generator_version from public.workout_plans
  where id = (current_setting('v21.result')::jsonb->>'planId')::uuid), 'v2.1.0',
  'new plan records generator version');
select is((current_setting('v21.result')::jsonb#>>'{quality,totalSlots}')::integer,
  18, 'standard plan has 18 slots');
select cmp_ok((current_setting('v21.result')::jsonb#>>'{quality,uniqueExercises}')::integer,
  '>=', 12, 'standard plan has at least 12 unique exercises');
select is(jsonb_array_length(current_setting('v21.result')::jsonb
  #>'{quality,exactExerciseOnAllDays}'), 0,
  'no exact exercise appears on all days');
select cmp_ok((current_setting('v21.result')::jsonb
  #>>'{quality,maxDayPairOverlapPercent}')::numeric, '<=', 50::numeric,
  'pairwise overlap stays within target');
select is((current_setting('v21.result')::jsonb
  #>>'{quality,mediaCoveragePercent}')::numeric, 100::numeric,
  'new plan has complete media coverage');
select is(jsonb_array_length(current_setting('v21.result')::jsonb
  #>'{quality,invalidEquipment}'), 0, 'new plan has no invalid equipment');
select is(jsonb_array_length(current_setting('v21.result')::jsonb
  #>'{quality,ineligibleExercises}'), 0, 'new plan has no ineligible exercises');
select is((select count(*)::integer from public.workout_sessions
  where id = 'd4000000-0000-0000-0000-000000000004'
    and workout_plan_id = 'd2000000-0000-0000-0000-000000000002'), 1,
  'completed history remains linked to archived plan');
select is((select count(*)::integer from public.workout_plans
  where user_id = 'd1000000-0000-0000-0000-000000000001'
    and status = 'active'), 1, 'exactly one plan remains active');

select * from finish();
rollback;
