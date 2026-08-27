begin;
grant usage on schema extensions to anon, authenticated, service_role;
set local search_path = public, extensions;
select plan(93);

select is((select count(*)::integer from public.exercises where training_role is null), 0,
  'every exercise has a programming training role');
select is(
  (select prosecdef from pg_proc where oid =
    'public.replace_plan_exercise_v212(uuid,uuid,boolean)'::regprocedure),
  false, 'public plan replacement RPC is SECURITY INVOKER');
select is(
  (select prosecdef from pg_proc where oid =
    'private.replace_plan_exercise_v212_internal(uuid,uuid,boolean)'::regprocedure),
  true, 'private plan replacement implementation is SECURITY DEFINER');
select ok(
  has_function_privilege('authenticated',
    'public.get_plan_replacement_candidates_v212(uuid,text,integer,integer)', 'execute')
  and has_function_privilege('authenticated',
    'public.replace_plan_exercise_v212(uuid,uuid,boolean)', 'execute')
  and has_function_privilege('authenticated',
    'public.preview_plan_rebalance_v212(uuid,uuid)', 'execute')
  and has_function_privilege('authenticated',
    'public.activate_plan_rebalance_v212(uuid)', 'execute')
  and has_function_privilege('authenticated',
    'public.undo_plan_exercise_change_v212(uuid)', 'execute'),
  'authenticated can execute the ownership-checked plan editing API');
select ok(
  not has_function_privilege('anon',
    'public.get_plan_replacement_candidates_v212(uuid,text,integer,integer)', 'execute')
  and not has_function_privilege('anon',
    'public.replace_plan_exercise_v212(uuid,uuid,boolean)', 'execute')
  and not has_function_privilege('anon',
    'public.preview_plan_rebalance_v212(uuid,uuid)', 'execute')
  and not has_function_privilege('anon',
    'public.activate_plan_rebalance_v212(uuid)', 'execute')
  and not has_function_privilege('anon',
    'public.undo_plan_exercise_change_v212(uuid)', 'execute'),
  'anonymous callers cannot edit plans');

insert into public.allowed_signup_emails(email, display_name, default_role)
values ('v212-owner@example.test', 'V212 Owner', 'member') on conflict do nothing;
insert into auth.users(
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
) values (
  'e1000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000', 'authenticated',
  'authenticated', 'v212-owner@example.test', 'x', now(), now(), now()
);
insert into public.training_preferences(
  user_id, sessions_per_week, session_minutes, cardio_preference,
  experience, training_location
) values (
  'e1000000-0000-4000-8000-000000000001', 2, 45, 2,
  'returning', 'full_gym'
);
insert into public.user_goals(user_id, goal_code, priority, active)
values ('e1000000-0000-4000-8000-000000000001', 'general_health', 1, true);

insert into public.exercises(
  slug, name_pt, category, movement_pattern, primary_muscles,
  secondary_muscles, difficulty, execution_instructions, active
) values
  ('v212-floor-press', 'Supino no chão com halteres', 'strength',
    'horizontal_push', array['peitoral'], array['triceps'], 'beginner',
    array['Execute com controle.'], false),
  ('v212-superman', 'Superman bilateral', 'strength',
    'posture', array['lombar'], array['gluteos'], 'beginner',
    array['Execute com controle.'], false),
  ('v212-squat', 'Agachamento V212', 'strength',
    'squat', array['quadriceps'], array['gluteos'], 'beginner',
    array['Execute com controle.'], false),
  ('v212-row', 'Remada V212', 'strength',
    'horizontal_pull', array['costas'], array['biceps'], 'beginner',
    array['Execute com controle.'], false),
  ('v212-hinge', 'Levantamento V212', 'strength',
    'hinge', array['posteriores'], array['gluteos'], 'beginner',
    array['Execute com controle.'], false),
  ('v212-shoulder', 'Desenvolvimento V212', 'strength',
    'vertical_push', array['ombros'], array['triceps'], 'beginner',
    array['Execute com controle.'], false),
  ('v212-bench-press', 'Supino com barra', 'strength',
    'horizontal_push', array['peitoral'], array['triceps'], 'beginner',
    array['Execute com controle.'], false),
  ('v212-push-up', 'Flexão de braços V212', 'strength',
    'horizontal_push', array['peitoral'], array['triceps'], 'beginner',
    array['Execute com controle.'], false),
  ('v212-goal-press', 'Press objetivo V214', 'strength',
    'vertical_push', array['peitoral'], array['triceps'], 'beginner',
    array['Execute com controle.'], false),
  ('v212-back-extension', 'Extensão lombar', 'strength',
    'posture', array['lombar'], array['gluteos'], 'beginner',
    array['Execute com controle.'], false);

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
  'exercises/' || exercise.slug || '/primary/v212.gif',
  'exercises/' || exercise.slug || '/primary/v212.webp',
  'processed', 'PRIMARY_DEMO', 'V212 fixture', 'public_domain',
  'https://example.test/' || exercise.slug,
  'https://example.test/' || exercise.slug || '.gif', 'PD',
  'https://example.test/public-domain', 'V212 fixture', 'Public Domain',
  md5(exercise.slug) || md5(exercise.slug), now(), now(), now(), 'approved',
  '{"correct_exercise":true,"compatible_equipment":true,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":true,"useful_framing":true,"no_blocking_elements":true,"license_confirmed":true}',
  true, 96, true, 12.5, 8, 'AUTOMATED_VALIDATED', 'automated',
  'vm-media-validator-v212-test', '2.1.2', 'HIGH',
  '{"exercise_match_exact":true,"equipment_match":true,"execution_quality_approved":true,"visibility_sufficient":true,"license_verified":true,"download_permitted":true,"transformation_permitted":true,"rehost_permitted":true,"source_provenance_verified":true,"visual_inspection_passed":true,"biomechanical_references_passed":true,"final_gif_inspection_passed":true,"storage_hash_verified":true}'
from public.exercises exercise where exercise.slug like 'v212-%';

insert into storage.objects(bucket_id, name, metadata)
select 'exercise-media', media.storage_path, '{"size":1024}'::jsonb
from public.exercise_media media join public.exercises exercise
  on exercise.id = media.exercise_id where exercise.slug like 'v212-%'
union all
select 'exercise-media', media.poster_path, '{"size":512}'::jsonb
from public.exercise_media media join public.exercises exercise
  on exercise.id = media.exercise_id where exercise.slug like 'v212-%';

set local role service_role;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"service_role"}', true);
select private.publish_validated_exercise_media_automated(
  media.id, 'vm-media-validator-v212-test', '2.1.2'
)
from public.exercise_media media join public.exercises exercise
  on exercise.id = media.exercise_id where exercise.slug like 'v212-%';
reset role;
update public.exercises set active = true where slug like 'v212-%';

select ok(private.exercises_are_semantically_equivalent_v212(
  (select id from public.exercises where slug = 'v212-floor-press'),
  (select id from public.exercises where slug = 'v212-bench-press')
), 'floor press and bench press are strict semantic equivalents');
select ok(not private.exercises_are_semantically_equivalent_v212(
  (select id from public.exercises where slug = 'v212-superman'),
  (select id from public.exercises where slug = 'v212-bench-press')
), 'Superman and bench press are not semantic equivalents');

insert into public.workout_plans(
  id, user_id, name, status, source, sessions_per_week,
  target_session_minutes, generator_version, goal_code
) values (
  'e2000000-0000-4000-8000-000000000002',
  'e1000000-0000-4000-8000-000000000001', 'Plano V212', 'draft',
  'generated', 2, 45, 'v2.1.1', 'general_health'
);
insert into public.workout_days(id, workout_plan_id, name, position, estimated_minutes)
values
  ('e3000000-0000-4000-8000-000000000003',
    'e2000000-0000-4000-8000-000000000002', 'Full Body A', 1, 45),
  ('e3000000-0000-4000-8000-000000000004',
    'e2000000-0000-4000-8000-000000000002', 'Full Body B', 2, 45);
insert into public.workout_day_exercises(
  id, workout_day_id, exercise_id, position, target_sets, rep_min, rep_max, rest_seconds
)
select fixture.slot_id, fixture.day_id, exercise.id, fixture.position, 3, 8, 12, 75
from (values
  ('e4000000-0000-4000-8000-000000000001'::uuid, 'e3000000-0000-4000-8000-000000000003'::uuid, 1, 'v212-floor-press'),
  ('e4000000-0000-4000-8000-000000000002'::uuid, 'e3000000-0000-4000-8000-000000000003'::uuid, 2, 'v212-superman'),
  ('e4000000-0000-4000-8000-000000000003'::uuid, 'e3000000-0000-4000-8000-000000000003'::uuid, 3, 'v212-squat'),
  ('e4000000-0000-4000-8000-000000000004'::uuid, 'e3000000-0000-4000-8000-000000000004'::uuid, 1, 'v212-row'),
  ('e4000000-0000-4000-8000-000000000005'::uuid, 'e3000000-0000-4000-8000-000000000004'::uuid, 2, 'v212-hinge'),
  ('e4000000-0000-4000-8000-000000000006'::uuid, 'e3000000-0000-4000-8000-000000000004'::uuid, 3, 'v212-shoulder')
) fixture(slot_id, day_id, position, slug)
join public.exercises exercise on exercise.slug = fixture.slug;
update public.workout_plans set status = 'active', activated_at = now()
where id = 'e2000000-0000-4000-8000-000000000002';

select ok(
  has_function_privilege('authenticated',
    'public.get_plan_replacement_candidates_v214(uuid,text,integer,integer,text)', 'execute')
  and has_function_privilege('authenticated',
    'public.replace_plan_exercise_v214(uuid,uuid,text,text,boolean)', 'execute')
  and has_function_privilege('authenticated',
    'public.preview_plan_rebalance_v214(uuid,uuid,text)', 'execute')
  and has_function_privilege('authenticated',
    'public.activate_plan_rebalance_v214(uuid)', 'execute'),
  'authenticated can execute the ownership-checked v2.1.4 plan API');
select ok(
  not has_function_privilege('anon',
    'public.get_plan_replacement_candidates_v214(uuid,text,integer,integer,text)', 'execute')
  and not has_function_privilege('anon',
    'public.replace_plan_exercise_v214(uuid,uuid,text,text,boolean)', 'execute'),
  'anonymous callers cannot use the v2.1.4 plan API');
select is(private.plan_replacement_type_v214(
  'e4000000-0000-4000-8000-000000000001',
  (select id from public.exercises where slug = 'v212-bench-press'),
  'e1000000-0000-4000-8000-000000000001'
), 'DIRECT_EQUIVALENT', 'strict semantic match is classified as direct equivalent');
select is(private.plan_replacement_type_v214(
  'e4000000-0000-4000-8000-000000000001',
  (select id from public.exercises where slug = 'v212-goal-press'),
  'e1000000-0000-4000-8000-000000000001'
), 'GOAL_ALIGNED_ALTERNATIVE',
  'safe whole-plan simulation classifies a non-equivalent goal fallback');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select count(*)::integer
  from public.get_plan_replacement_candidates_v214(
    'e4000000-0000-4000-8000-000000000001', null, 30, 0, 'user_choice'
  ) where exercise_name = 'Supino com barra'
    and replacement_type = 'DIRECT_EQUIVALENT'), 1,
  'v2.1.4 candidates expose direct equivalents as direct equivalents');
select is((select count(*)::integer
  from public.get_plan_replacement_candidates_v214(
    'e4000000-0000-4000-8000-000000000001', null, 30, 0, 'user_choice'
  ) where exercise_name = 'Press objetivo V214'
    and replacement_type = 'GOAL_ALIGNED_ALTERNATIVE'), 1,
  'v2.1.4 candidates expose a safe fallback without calling it equivalent');
select ok((select goal_alignment_reason <> ''
  from public.get_plan_replacement_candidates_v214(
    'e4000000-0000-4000-8000-000000000001', 'Press objetivo V214', 5, 0,
    'user_choice'
  ) where exercise_name = 'Press objetivo V214'),
  'goal-aligned candidate explains why it preserves the selected goal');
reset role;

insert into public.workout_sessions(
  id, user_id, workout_day_id, workout_plan_id, status, completed_at
) values (
  'e5000000-0000-4000-8000-000000000005',
  'e1000000-0000-4000-8000-000000000001',
  'e3000000-0000-4000-8000-000000000003',
  'e2000000-0000-4000-8000-000000000002', 'completed', now()
);

select throws_ok(
  $$update public.workout_day_exercises set target_sets = 4
    where id = 'e4000000-0000-4000-8000-000000000001'$$,
  'A estrutura do plano ativo exige uma nova versão',
  'active plan slots cannot be directly mutated');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select count(*)::integer
  from public.get_plan_replacement_candidates_v212(
    'e4000000-0000-4000-8000-000000000001', null, 5, 0
  ) where exercise_name = 'Supino com barra' and is_equivalent), 1,
  'bench press is offered for floor press as a direct equivalent');
select is((select count(*)::integer
  from public.get_plan_replacement_candidates_v212(
    'e4000000-0000-4000-8000-000000000002', 'Supino com barra', 5, 0
  ) where exercise_name = 'Supino com barra' and not is_equivalent), 1,
  'bench press search for Superman is labeled non-equivalent');
select lives_ok($$select set_config('v212.direct',
  public.replace_plan_exercise_v212(
    'e4000000-0000-4000-8000-000000000001',
    (select id from public.exercises where slug = 'v212-bench-press'), true
  )::text, true)$$, 'direct equivalent replacement activates atomically');
reset role;

select is((select status from public.workout_plans
  where id = 'e2000000-0000-4000-8000-000000000002'), 'archived',
  'direct replacement archives the source plan');
select is((select status from public.workout_plans
  where id = (current_setting('v212.direct')::jsonb->>'planId')::uuid), 'active',
  'direct replacement activates the resulting plan');
select is((current_setting('v212.direct')::jsonb#>>'{quality,mediaCoveragePercent}')::numeric,
  100::numeric, 'direct replacement retains complete media coverage');
select is((select count(*)::integer from public.workout_sessions
  where id = 'e5000000-0000-4000-8000-000000000005'
    and workout_plan_id = 'e2000000-0000-4000-8000-000000000002'), 1,
  'past workout history remains linked to the source plan');
select is((select preference from public.user_exercise_preferences
  where user_id = 'e1000000-0000-4000-8000-000000000001'
    and exercise_id = (select id from public.exercises where slug = 'v212-floor-press')),
  'avoid', 'persistent dislike excludes the source exercise from future generation');
select is((select count(*)::integer from public.workout_plans
  where user_id = 'e1000000-0000-4000-8000-000000000001' and status = 'active'), 1,
  'direct replacement leaves exactly one active plan');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$select public.undo_plan_exercise_change_v212(
  (current_setting('v212.direct')::jsonb->>'eventId')::uuid
)$$, 'direct replacement can be undone');
reset role;
select is((select status from public.workout_plans
  where id = 'e2000000-0000-4000-8000-000000000002'), 'active',
  'undo restores the source plan');
select is((select count(*)::integer from public.user_exercise_preferences
  where user_id = 'e1000000-0000-4000-8000-000000000001'
    and exercise_id = (select id from public.exercises where slug = 'v212-floor-press')), 0,
  'undo restores the previous exercise preference state');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$select set_config('v213.single_false',
  public.replace_plan_exercise_v212(
    'e4000000-0000-4000-8000-000000000001',
    (select id from public.exercises where slug = 'v212-bench-press'), false
  )::text, true)$$, 'single occurrence replacement passes without persistence');
reset role;
select is(current_setting('v213.single_false')::jsonb->>'persistentExclusion',
  'false', 'single occurrence result reports persistence disabled');
select is((current_setting('v213.single_false')::jsonb->>'remainingOccurrenceCount')::integer,
  0, 'single occurrence result reports no remaining source slots');
select is((select count(*)::integer from public.user_exercise_preferences
  where user_id = 'e1000000-0000-4000-8000-000000000001'
    and exercise_id = (select id from public.exercises where slug = 'v212-floor-press')), 0,
  'replacement without persistence creates no preference');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$select public.undo_plan_exercise_change_v212(
  (current_setting('v213.single_false')::jsonb->>'eventId')::uuid
)$$, 'single occurrence replacement without persistence can be undone');
reset role;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$select set_config('v212.preview',
  public.preview_plan_rebalance_v212(
    'e4000000-0000-4000-8000-000000000002',
    (select id from public.exercises where slug = 'v212-bench-press')
  )::text, true)$$, 'non-equivalent request creates a validated rebalance preview');
reset role;
select is((select status from public.workout_plans
  where id = (current_setting('v212.preview')::jsonb->>'planId')::uuid), 'draft',
  'rebalance preview remains a draft');
select is((select status from public.workout_plans
  where id = 'e2000000-0000-4000-8000-000000000002'), 'active',
  'preview does not silently replace the active plan');
select is(jsonb_array_length(current_setting('v212.preview')::jsonb->'changes'), 2,
  'preview explains both changed exercises');
select is((current_setting('v212.preview')::jsonb#>>'{quality,mediaCoveragePercent}')::numeric,
  100::numeric, 'rebalance preview retains complete media coverage');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$select set_config('v212.rebalance',
  public.activate_plan_rebalance_v212(
    (current_setting('v212.preview')::jsonb->>'planId')::uuid
  )::text, true)$$, 'confirmed rebalance activates atomically');
reset role;
select is((select status from public.workout_plans
  where id = (current_setting('v212.preview')::jsonb->>'planId')::uuid), 'active',
  'confirmed preview becomes active');
select is((select change_type from public.plan_exercise_change_events
  where id = (current_setting('v212.rebalance')::jsonb->>'eventId')::uuid),
  'rebalance', 'reorganization is audited distinctly from direct replacement');
select is((select count(*)::integer from public.workout_sessions
  where id = 'e5000000-0000-4000-8000-000000000005'), 1,
  'rebalance also preserves workout history');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$select public.undo_plan_exercise_change_v212(
  (current_setting('v212.rebalance')::jsonb->>'eventId')::uuid
)$$, 'confirmed rebalance can be undone');
reset role;
select is((select status from public.workout_plans
  where id = 'e2000000-0000-4000-8000-000000000002'), 'active',
  'rebalance undo restores the original plan');
select is((select count(*)::integer from public.workout_plans
  where user_id = 'e1000000-0000-4000-8000-000000000001' and status = 'active'), 1,
  'undo leaves exactly one active plan');

-- v2.1.3 regression: persisting an exclusion must not block a selected-slot
-- swap when the same exercise appears elsewhere in the current active plan.
update public.workout_plans set status = 'archived', archived_at = now()
where id = 'e2000000-0000-4000-8000-000000000002';
update public.workout_day_exercises
set exercise_id = (select id from public.exercises where slug = 'v212-floor-press')
where id = 'e4000000-0000-4000-8000-000000000004';
update public.workout_plans
set status = 'active', activated_at = now(), archived_at = null
where id = 'e2000000-0000-4000-8000-000000000002';

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$select set_config('v213.direct',
  public.replace_plan_exercise_v212(
    'e4000000-0000-4000-8000-000000000001',
    (select id from public.exercises where slug = 'v212-bench-press'), true
  )::text, true)$$,
  'persistent replacement succeeds when the source occurs on another day');
reset role;

select is((current_setting('v213.direct')::jsonb->>'remainingOccurrenceCount')::integer,
  1, 'direct result reports the remaining current-plan occurrence');
select is((select preference from public.user_exercise_preferences
  where user_id = 'e1000000-0000-4000-8000-000000000001'
    and exercise_id = (select id from public.exercises where slug = 'v212-floor-press')),
  'avoid', 'future-plan avoid preference is persisted immediately');
select is((select count(*)::integer
  from public.workout_days day
  join public.workout_day_exercises slot on slot.workout_day_id = day.id
  where day.workout_plan_id = (current_setting('v213.direct')::jsonb->>'planId')::uuid
    and slot.exercise_id = (select id from public.exercises where slug = 'v212-floor-press')),
  1, 'the other current-plan occurrence remains unchanged');
select ok(not private.exercise_auto_plan_eligible(
  (select id from public.exercises where slug = 'v212-floor-press'),
  'e1000000-0000-4000-8000-000000000001'),
  'future automatic generation excludes the avoided source exercise');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$select set_config('v213.preview',
  public.preview_remaining_exclusions_v213(
    (current_setting('v213.direct')::jsonb->>'eventId')::uuid
  )::text, true)$$,
  'optional reorganization creates a strict-equivalent draft');
reset role;

select is((select status from public.workout_plans
  where id = (current_setting('v213.preview')::jsonb->>'planId')::uuid),
  'draft', 'remaining-occurrence preview is not silently activated');
select is((select status from public.workout_plans
  where id = (current_setting('v213.direct')::jsonb->>'planId')::uuid),
  'active', 'canceling or reviewing the optional preview keeps the completed swap active');
select is(jsonb_array_length(current_setting('v213.preview')::jsonb->'changes'),
  1, 'preview explains every remaining occurrence change');
select is((select count(*)::integer
  from public.workout_days day
  join public.workout_day_exercises slot on slot.workout_day_id = day.id
  where day.workout_plan_id = (current_setting('v213.preview')::jsonb->>'planId')::uuid
    and slot.exercise_id = (select id from public.exercises where slug = 'v212-floor-press')),
  0, 'preview removes all remaining occurrences from its draft only');
select is((current_setting('v213.preview')::jsonb#>>'{quality,mediaCoveragePercent}')::numeric,
  100::numeric, 'remaining-occurrence preview retains complete media coverage');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$select set_config('v213.rebalance',
  public.activate_remaining_exclusions_v213(
    (current_setting('v213.preview')::jsonb->>'planId')::uuid
  )::text, true)$$,
  'explicit confirmation activates the remaining-occurrence reorganization');
reset role;
select is((select status from public.workout_plans
  where id = (current_setting('v213.preview')::jsonb->>'planId')::uuid),
  'active', 'confirmed remaining-occurrence preview becomes active');
select is((select count(*)::integer
  from public.workout_days day
  join public.workout_day_exercises slot on slot.workout_day_id = day.id
  where day.workout_plan_id = (current_setting('v213.preview')::jsonb->>'planId')::uuid
    and slot.exercise_id = (select id from public.exercises where slug = 'v212-floor-press')),
  0, 'confirmed reorganization excludes the source from the current plan');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$select public.undo_plan_exercise_change_v212(
  (current_setting('v213.rebalance')::jsonb->>'eventId')::uuid
)$$, 'remaining-occurrence reorganization can be undone independently');
reset role;
select is((select status from public.workout_plans
  where id = (current_setting('v213.direct')::jsonb->>'planId')::uuid),
  'active', 'reorganization undo restores the already-completed simple swap');
select is((select preference from public.user_exercise_preferences
  where user_id = 'e1000000-0000-4000-8000-000000000001'
    and exercise_id = (select id from public.exercises where slug = 'v212-floor-press')),
  'avoid', 'reorganization undo keeps the persistent future preference');
select is((select count(*)::integer
  from public.workout_days day
  join public.workout_day_exercises slot on slot.workout_day_id = day.id
  where day.workout_plan_id = (current_setting('v213.direct')::jsonb->>'planId')::uuid
    and slot.exercise_id = (select id from public.exercises where slug = 'v212-floor-press')),
  1, 'reorganization undo restores the untouched other occurrence');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$select public.undo_plan_exercise_change_v212(
  (current_setting('v213.direct')::jsonb->>'eventId')::uuid
)$$, 'simple persistent swap still supports exact undo');
reset role;
select is((select count(*)::integer from public.user_exercise_preferences
  where user_id = 'e1000000-0000-4000-8000-000000000001'
    and exercise_id = (select id from public.exercises where slug = 'v212-floor-press')),
  0, 'simple undo restores the exact previous preference state');
select is((select count(*)::integer
  from public.workout_days day
  join public.workout_day_exercises slot on slot.workout_day_id = day.id
  where day.workout_plan_id = 'e2000000-0000-4000-8000-000000000002'
    and slot.exercise_id = (select id from public.exercises where slug = 'v212-floor-press')),
  2, 'simple undo restores the original plan including both occurrences');
select ok((select undone_at is not null from public.plan_exercise_change_events
  where id = (current_setting('v213.direct')::jsonb->>'eventId')::uuid),
  'simple undo keeps a resolved audit event instead of an orphan');
select is((select count(*)::integer from public.workout_plans
  where user_id = 'e1000000-0000-4000-8000-000000000001' and status = 'active'),
  1, 'v2.1.3 undo leaves exactly one active plan');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$select set_config('v214.direct',
  public.replace_plan_exercise_v214(
    'e4000000-0000-4000-8000-000000000001',
    (select id from public.exercises where slug = 'v212-bench-press'),
    'DIRECT_EQUIVALENT', 'exercise_dislike', false
  )::text, true)$$, 'v2.1.4 direct equivalent activates atomically');
reset role;
select is((select replacement_type from public.plan_exercise_change_events
  where id = (current_setting('v214.direct')::jsonb->>'eventId')::uuid),
  'DIRECT_EQUIVALENT', 'direct event records its backend classification');
select is((select reason_code from public.plan_exercise_change_events
  where id = (current_setting('v214.direct')::jsonb->>'eventId')::uuid),
  'exercise_dislike', 'direct event records the canonical reason');
select is((select generator_version from public.workout_plans
  where id = (current_setting('v214.direct')::jsonb->>'planId')::uuid),
  'v2.1.4', 'direct result is versioned as v2.1.4');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$select public.undo_plan_exercise_change_v212(
  (current_setting('v214.direct')::jsonb->>'eventId')::uuid
)$$, 'existing exact undo restores a v2.1.4 direct change');
select lives_ok($$select set_config('v214.goal',
  public.replace_plan_exercise_v214(
    'e4000000-0000-4000-8000-000000000001',
    (select id from public.exercises where slug = 'v212-goal-press'),
    'GOAL_ALIGNED_ALTERNATIVE', 'user_choice', false
  )::text, true)$$, 'goal-aligned fallback activates only after server validation');
reset role;
select is((select replacement_type from public.plan_exercise_change_events
  where id = (current_setting('v214.goal')::jsonb->>'eventId')::uuid),
  'GOAL_ALIGNED_ALTERNATIVE', 'goal fallback event is not mislabeled equivalent');
select is((current_setting('v214.goal')::jsonb#>>'{quality,mediaCoveragePercent}')::numeric,
  100::numeric, 'goal-aligned fallback retains complete media coverage');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$select public.undo_plan_exercise_change_v212(
  (current_setting('v214.goal')::jsonb->>'eventId')::uuid
)$$, 'goal-aligned fallback supports exact undo');
reset role;

insert into public.workout_sessions(
  id, user_id, workout_day_id, workout_plan_id, status
) values (
  'e5000000-0000-4000-8000-000000000214',
  'e1000000-0000-4000-8000-000000000001',
  'e3000000-0000-4000-8000-000000000003',
  'e2000000-0000-4000-8000-000000000002', 'in_progress'
);
insert into public.workout_session_exercises(
  id, workout_session_id, planned_exercise_id, actual_exercise_id, position
) select 'e6000000-0000-4000-8000-000000000214',
  'e5000000-0000-4000-8000-000000000214', exercise.id, exercise.id, 1
from public.exercises exercise where exercise.slug = 'v212-floor-press';

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select count(*)::integer
  from public.get_workout_replacement_candidates_v214(
    'e6000000-0000-4000-8000-000000000214', 'user_choice', null, null, 30, 0
  ) where exercise_name = 'Supino com barra'
    and replacement_type = 'DIRECT_EQUIVALENT'), 1,
  'session-only candidates include the direct equivalent');
select is((select count(*)::integer
  from public.get_workout_replacement_candidates_v214(
    'e6000000-0000-4000-8000-000000000214', 'user_choice', null, null, 30, 0
  ) where replacement_type = 'REQUIRES_REBALANCE'), 0,
  'session-only candidates never offer silent weekly rebalance');
select lives_ok($$select set_config('v214.session',
  public.substitute_workout_exercise_v214(
    'e6000000-0000-4000-8000-000000000214',
    (select id from public.exercises where slug = 'v212-bench-press'),
    'DIRECT_EQUIVALENT', 'exercise_dislike', null, true
  )::text, true)$$, 'selected session-only substitution is atomic');
reset role;
select is((select scope from public.workout_substitution_events
  where id = (current_setting('v214.session')::jsonb->>'eventId')::uuid),
  'session', 'session event records session scope');
select is((select reason_code from public.workout_substitution_events
  where id = (current_setting('v214.session')::jsonb->>'eventId')::uuid),
  'exercise_dislike', 'session event records the canonical reason');
select is((select actual_exercise_id from public.workout_session_exercises
  where id = 'e6000000-0000-4000-8000-000000000214'),
  (select id from public.exercises where slug = 'v212-bench-press'),
  'session actual exercise changes to the selected candidate');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$select public.undo_workout_substitution_v214(
  (current_setting('v214.session')::jsonb->>'eventId')::uuid
)$$, 'session substitution undo restores preference and exercise atomically');
reset role;
select is((select actual_exercise_id from public.workout_session_exercises
  where id = 'e6000000-0000-4000-8000-000000000214'),
  (select id from public.exercises where slug = 'v212-floor-press'),
  'session undo restores the prior actual exercise');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
insert into public.workout_plans(
  id, user_id, name, status, sessions_per_week, target_session_minutes
) values (
  'e7000000-0000-4000-8000-000000000214',
  'e1000000-0000-4000-8000-000000000001',
  'Latest V214 plan', 'draft', 2, 45
);
insert into public.workout_days(
  id, workout_plan_id, name, position, estimated_minutes
) values (
  'e7100000-0000-4000-8000-000000000214',
  'e7000000-0000-4000-8000-000000000214', 'Latest day', 1, 45
);
insert into public.workout_day_exercises(
  id, workout_day_id, exercise_id, position, target_sets, rep_min, rep_max,
  rest_seconds
) select
  'e7200000-0000-4000-8000-000000000214',
  'e7100000-0000-4000-8000-000000000214', exercise.id, 1, 3, 8, 12, 60
from public.exercises exercise where exercise.slug = 'v212-floor-press';
update public.workout_plans
set status = 'archived', archived_at = now()
where id = 'e2000000-0000-4000-8000-000000000002';
update public.workout_plans
set status = 'active', activated_at = now(), archived_at = null
where id = 'e7000000-0000-4000-8000-000000000214';
select lives_ok($$select set_config('v214.latest_session',
  public.start_workout('e7100000-0000-4000-8000-000000000214')::text, true)$$,
  'starting the latest plan safely resolves an archived-plan session');
select is((select status from public.workout_sessions
  where id = 'e5000000-0000-4000-8000-000000000214'), 'cancelled',
  'archived-plan in-progress session is cancelled instead of resumed');
select ok((select completed_at is null
    and cancellation_reason =
      'Sessão antiga descartada após ativação de novo plano'
  from public.workout_sessions
  where id = 'e5000000-0000-4000-8000-000000000214'),
  'stale cancellation is not misclassified as completion');
select is((select count(*)::integer from public.workout_session_exercises
  where workout_session_id = 'e5000000-0000-4000-8000-000000000214'), 1,
  'stale session exercise snapshot remains intact');
select ok((select workout_plan_id = 'e7000000-0000-4000-8000-000000000214'
    and workout_day_id = 'e7100000-0000-4000-8000-000000000214'
    and status = 'in_progress'
  from public.workout_sessions
  where id = current_setting('v214.latest_session')::uuid),
  'new session belongs to the current active plan and selected day');
select is((select actual_exercise_id
  from public.workout_session_exercises
  where workout_session_id = current_setting('v214.latest_session')::uuid),
  (select exercise_id from public.workout_day_exercises
   where id = 'e7200000-0000-4000-8000-000000000214'),
  'new session snapshots the latest plan exercise');
select is(public.start_workout('e7100000-0000-4000-8000-000000000214'),
  current_setting('v214.latest_session')::uuid,
  'a current-plan session still resumes normally');
reset role;
select is((select count(*)::integer from public.workout_sessions
  where user_id = 'e1000000-0000-4000-8000-000000000001'
    and status = 'in_progress'), 1,
  'stale recovery leaves exactly one current active session');
select is((select status from public.workout_sessions
  where id = 'e5000000-0000-4000-8000-000000000005'), 'completed',
  'completed workout history remains unchanged');

select * from finish();
rollback;
