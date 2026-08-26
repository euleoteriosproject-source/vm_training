begin;
grant usage on schema extensions to anon, authenticated, service_role;
set local search_path = public, extensions;
select plan(12);

select has_index('public', 'gym_equipment_presets', 'gym_equipment_presets_equipment_id_idx', 'gym preset equipment FK is indexed');
select has_index('public', 'workout_substitution_events', 'workout_substitution_events_equipment_id_idx', 'substitution equipment FK is indexed');
select has_index('public', 'workout_substitution_events', 'workout_substitution_events_from_exercise_id_idx', 'substitution source FK is indexed');
select has_index('public', 'workout_substitution_events', 'workout_substitution_events_session_exercise_id_idx', 'substitution session exercise FK is indexed');
select has_index('public', 'workout_substitution_events', 'workout_substitution_events_to_exercise_id_idx', 'substitution target FK is indexed');
select is(
  (select prosecdef from pg_proc where oid = 'public.start_workout(uuid)'::regprocedure),
  false,
  'media-ready start RPC remains SECURITY INVOKER'
);
select ok(
  has_function_privilege('authenticated', 'public.start_workout(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.start_workout(uuid)', 'execute'),
  'only authenticated can start a workout'
);

insert into public.allowed_signup_emails(email, display_name, default_role)
values ('v20-plan-owner@example.test', 'V20 Plan Owner', 'member')
on conflict do nothing;
insert into auth.users(
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
)
values (
  'a1000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'v20-plan-owner@example.test', 'x',
  now(), now(), now()
);

insert into public.training_preferences(
  user_id, sessions_per_week, session_minutes, cardio_preference,
  experience, training_location
) values (
  'a1000000-0000-0000-0000-000000000001', 2, 45, 1,
  'returning', 'full_gym'
);
insert into public.user_equipment(user_id,equipment_id,available)
select 'a1000000-0000-0000-0000-000000000001', link.equipment_id, true
from public.exercise_equipment link
join public.exercises exercise on exercise.id = link.exercise_id
where exercise.slug = 'leg-press' and link.required
on conflict (user_id,equipment_id) do update set available = true;

set local role service_role;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"service_role"}',
  true
);
update public.exercises set active = true where slug = 'leg-press';
insert into public.exercise_media(
  id, exercise_id, media_type, storage_path, poster_path, status, media_role,
  source_name, source_type, source_url, original_file_url, license_code,
  license_url, author, attribution_text, content_hash, verified_at,
  reviewed_at, processed_at, execution_quality, review_checklist,
  animation_verified, frame_count, animation_loop, frames_per_second,
  duration_seconds, review_state, review_method, review_agent,
  validation_version, validation_confidence, automated_validation
)
select
  'a2000000-0000-0000-0000-000000000002', id, 'gif',
  'exercises/leg-press/primary/v20.gif',
  'exercises/leg-press/primary/v20.webp', 'processed', 'PRIMARY_DEMO',
  'V20 fixture', 'public_domain', 'https://example.test/v20-leg-press',
  'https://example.test/v20-leg-press.webm', 'PD',
  'https://example.test/public-domain', 'V20 fixture', 'V20 fixture / PD',
  repeat('b',64), now(), now(), now(), 'approved',
  '{"correct_exercise":true,"compatible_equipment":true,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":true,"useful_framing":true,"no_blocking_elements":true,"license_confirmed":true}',
  true, 96, true, 12.5, 8, 'AUTOMATED_VALIDATED', 'automated',
  'vm-media-validator-v20-test', '2.0', 'HIGH',
  '{"exercise_match_exact":true,"equipment_match":true,"execution_quality_approved":true,"visibility_sufficient":true,"license_verified":true,"download_permitted":true,"transformation_permitted":true,"rehost_permitted":true,"source_provenance_verified":true,"visual_inspection_passed":true,"biomechanical_references_passed":true,"final_gif_inspection_passed":true,"storage_hash_verified":true}'
from public.exercises where slug = 'leg-press';
insert into storage.objects(bucket_id,name,metadata) values
  ('exercise-media','exercises/leg-press/primary/v20.gif','{"size":1024}'::jsonb),
  ('exercise-media','exercises/leg-press/primary/v20.webp','{"size":512}'::jsonb);
select private.publish_validated_exercise_media_automated(
  'a2000000-0000-0000-0000-000000000002',
  'vm-media-validator-v20-test',
  '2.0'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
insert into public.workout_plans(
  id, user_id, name, status, sessions_per_week, target_session_minutes
) values (
  'a3000000-0000-0000-0000-000000000003',
  'a1000000-0000-0000-0000-000000000001',
  'V20 ready plan', 'draft', 2, 45
);
insert into public.workout_days(id, workout_plan_id, name, position, estimated_minutes)
values (
  'a4000000-0000-0000-0000-000000000004',
  'a3000000-0000-0000-0000-000000000003', 'A', 1, 45
);
insert into public.workout_day_exercises(
  id, workout_day_id, exercise_id, position, target_sets, rep_min, rep_max
)
select
  'a5000000-0000-0000-0000-000000000005',
  'a4000000-0000-0000-0000-000000000004', id, 1, 2, 8, 12
from public.exercises where slug = 'leg-press';
select lives_ok(
  $$select public.activate_plan('a3000000-0000-0000-0000-000000000003')$$,
  'a fully media-ready plan activates'
);

select ok(
  public.start_workout('a4000000-0000-0000-0000-000000000004') is not null,
  'media-ready workout starts'
);
select is(
  public.start_workout('a4000000-0000-0000-0000-000000000004'),
  (select id from public.workout_sessions
   where user_id = 'a1000000-0000-0000-0000-000000000001'
     and status = 'in_progress'),
  'duplicate start resumes the existing session'
);
select throws_ok(
  $$update public.workout_session_exercises
    set actual_exercise_id = (select id from public.exercises where slug = 'dead-bug')
    where workout_session_id = (
      select id from public.workout_sessions
      where user_id = 'a1000000-0000-0000-0000-000000000001'
        and status = 'in_progress'
    )$$,
  'P0001',
  'Substituição bloqueada: exercício sem PRIMARY_DEMO aprovada',
  'runtime substitution without approved media is blocked'
);
reset role;

set local role service_role;
set constraints active_plan_keeps_primary_media immediate;
select throws_ok(
  $$update public.exercise_media
    set status = 'reviewing', is_primary = false
    where id = 'a2000000-0000-0000-0000-000000000002'$$,
  'P0001',
  'PRIMARY_DEMO usada por plano ativo não pode regredir sem substituição aprovada',
  'an active plan cannot lose its only approved PRIMARY'
);
reset role;

select * from finish();
rollback;
