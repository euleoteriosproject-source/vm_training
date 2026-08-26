begin;
grant usage on schema extensions to anon, authenticated, service_role;
set local search_path = public, extensions;
select plan(31);

select is(
  (select prosecdef from pg_proc where oid = 'public.substitute_workout_exercise(uuid,text,uuid,uuid[])'::regprocedure),
  false,
  'public substitute RPC is SECURITY INVOKER'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.undo_workout_substitution(uuid)'::regprocedure),
  false,
  'public undo RPC is SECURITY INVOKER'
);
select is(
  (select prosecdef from pg_proc where oid = 'private.substitute_workout_exercise_internal(uuid,text,uuid,uuid[])'::regprocedure),
  true,
  'private substitute implementation is SECURITY DEFINER'
);
select is(
  (select prosecdef from pg_proc where oid = 'private.undo_workout_substitution_internal(uuid)'::regprocedure),
  true,
  'private undo implementation is SECURITY DEFINER'
);
select ok(
  has_function_privilege('authenticated', 'public.substitute_workout_exercise(uuid,text,uuid,uuid[])', 'execute')
  and has_function_privilege('authenticated', 'public.undo_workout_substitution(uuid)', 'execute'),
  'authenticated can execute only the public substitution API'
);
select ok(
  not has_function_privilege('anon', 'public.substitute_workout_exercise(uuid,text,uuid,uuid[])', 'execute')
  and not has_function_privilege('anon', 'public.undo_workout_substitution(uuid)', 'execute'),
  'anon cannot execute the public substitution API'
);
select ok(
  has_function_privilege('authenticated', 'private.substitute_workout_exercise_internal(uuid,text,uuid,uuid[])', 'execute')
  and has_function_privilege('authenticated', 'private.undo_workout_substitution_internal(uuid)', 'execute'),
  'authenticated has the minimum internal execution path'
);
select ok(
  not has_function_privilege('anon', 'private.substitute_workout_exercise_internal(uuid,text,uuid,uuid[])', 'execute')
  and not has_function_privilege('service_role', 'private.substitute_workout_exercise_internal(uuid,text,uuid,uuid[])', 'execute')
  and not has_function_privilege('supabase_auth_admin', 'private.substitute_workout_exercise_internal(uuid,text,uuid,uuid[])', 'execute')
  and not has_function_privilege('anon', 'private.undo_workout_substitution_internal(uuid)', 'execute')
  and not has_function_privilege('service_role', 'private.undo_workout_substitution_internal(uuid)', 'execute')
  and not has_function_privilege('supabase_auth_admin', 'private.undo_workout_substitution_internal(uuid)', 'execute'),
  'internal implementations reject unrelated API roles'
);

insert into public.allowed_signup_emails(email, display_name, default_role)
values
  ('substitution-a@example.test', 'Substitution A', 'member'),
  ('substitution-b@example.test', 'Substitution B', 'member')
on conflict do nothing;

insert into auth.users(
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
)
values
  ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'substitution-a@example.test', 'x', now(), now(), now()),
  ('b2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'substitution-b@example.test', 'x', now(), now(), now());

insert into public.user_equipment(user_id, equipment_id, available, source)
select user_id, equipment.id, true, 'user_override'
from (
  values
    ('a1000000-0000-0000-0000-000000000001'::uuid),
    ('b2000000-0000-0000-0000-000000000002'::uuid)
) users(user_id)
cross join public.equipment
on conflict(user_id, equipment_id) do update set available = true, source = 'user_override';

-- seed.sql intentionally leaves the catalog inactive. Production has the
-- reviewed catalog active; make that precondition explicit for this isolated
-- substitution contract.
update public.exercises set active = true;

-- v2.1 only permits runtime replacements with a published PRIMARY_DEMO.
-- Keep this media fixture local to the rolled-back test transaction.
set local role service_role;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"service_role"}',
  true
);
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
  'c7000000-0000-0000-0000-000000000007', id, 'gif',
  'exercises/goblet-squat/primary/substitution-v21.gif',
  'exercises/goblet-squat/primary/substitution-v21.webp',
  'processed', 'PRIMARY_DEMO', 'V21 substitution fixture',
  'public_domain', 'https://example.test/v21-goblet-squat',
  'https://example.test/v21-goblet-squat.webm', 'PD',
  'https://example.test/public-domain', 'V21 fixture', 'V21 fixture / PD',
  repeat('c',64), now(), now(), now(), 'approved',
  '{"correct_exercise":true,"compatible_equipment":true,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":true,"useful_framing":true,"no_blocking_elements":true,"license_confirmed":true}',
  true, 96, true, 12.5, 8, 'AUTOMATED_VALIDATED', 'automated',
  'vm-media-validator-v21-test', '2.1', 'HIGH',
  '{"exercise_match_exact":true,"equipment_match":true,"execution_quality_approved":true,"visibility_sufficient":true,"license_verified":true,"download_permitted":true,"transformation_permitted":true,"rehost_permitted":true,"source_provenance_verified":true,"visual_inspection_passed":true,"biomechanical_references_passed":true,"final_gif_inspection_passed":true,"storage_hash_verified":true}'
from public.exercises where slug = 'goblet-squat';
insert into storage.objects(bucket_id,name,metadata) values
  ('exercise-media','exercises/goblet-squat/primary/substitution-v21.gif','{"size":1024}'::jsonb),
  ('exercise-media','exercises/goblet-squat/primary/substitution-v21.webp','{"size":512}'::jsonb);
select private.publish_validated_exercise_media_automated(
  'c7000000-0000-0000-0000-000000000007',
  'vm-media-validator-v21-test',
  '2.1'
);
reset role;

insert into public.workout_sessions(id, user_id, status)
values
  ('a3000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'in_progress'),
  ('b4000000-0000-0000-0000-000000000004', 'b2000000-0000-0000-0000-000000000002', 'in_progress');

insert into public.workout_session_exercises(
  id, workout_session_id, planned_exercise_id, actual_exercise_id, position
)
select
  fixture.session_exercise_id,
  fixture.session_id,
  exercise.id,
  exercise.id,
  1
from (
  values
    ('a5000000-0000-0000-0000-000000000005'::uuid, 'a3000000-0000-0000-0000-000000000003'::uuid),
    ('b6000000-0000-0000-0000-000000000006'::uuid, 'b4000000-0000-0000-0000-000000000004'::uuid)
) fixture(session_exercise_id, session_id)
join public.exercises exercise on exercise.slug = 'leg-press';

create function pg_temp.reject_equipment_restore() returns trigger
language plpgsql
as $$
begin
  if current_setting('test.reject_equipment_restore', true) = 'on'
     and new.available then
    raise exception 'forced equipment restoration failure';
  end if;
  return new;
end;
$$;
create trigger reject_equipment_restore
before update on public.user_equipment
for each row execute function pg_temp.reject_equipment_restore();

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"b2000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
select lives_ok(
  $$select public.substitute_workout_exercise(
    'b6000000-0000-0000-0000-000000000006',
    'user_requested',
    null,
    '{}'::uuid[]
  )$$,
  'B can substitute B own session exercise'
);
select set_config(
  'test.b_event_id',
  (select id::text from public.workout_substitution_events where user_id = 'b2000000-0000-0000-0000-000000000002' limit 1),
  true
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
select throws_ok(
  $$select public.substitute_workout_exercise(
    'b6000000-0000-0000-0000-000000000006',
    'user_requested',
    null,
    '{}'::uuid[]
  )$$,
  'P0001',
  'Exercício da sessão não encontrado',
  'A cannot substitute B session exercise'
);
select throws_ok(
  $$select public.undo_workout_substitution(
    current_setting('test.b_event_id')::uuid
  )$$,
  'P0001',
  'Substituição não encontrada ou já desfeita',
  'A cannot undo B substitution even with the event ID'
);
select lives_ok(
  $$update public.user_equipment
    set available = false
    where user_id = 'b2000000-0000-0000-0000-000000000002'$$,
  'A cross-user equipment update reaches no writable rows'
);
select throws_ok(
  $$update public.workout_substitution_events
    set undone_at = now()
    where user_id = 'b2000000-0000-0000-0000-000000000002'$$,
  '42501',
  null,
  'A cannot modify B substitution event directly'
);
select throws_ok(
  $$select public.substitute_workout_exercise(
    'a5000000-0000-0000-0000-000000000005',
    'arbitrary_reason',
    null,
    '{}'::uuid[]
  )$$,
  'P0001',
  'Motivo de substituição inválido',
  'arbitrary substitution reasons are rejected'
);
select throws_ok(
  $$select public.substitute_workout_exercise(
    'a5000000-0000-0000-0000-000000000005',
    'equipment_unavailable',
    (select id from public.equipment where slug = 'bike'),
    '{}'::uuid[]
  )$$,
  'P0001',
  'Equipamento não pertence ao exercício atual',
  'equipment must belong to the current exercise'
);
select throws_ok(
  $$select public.substitute_workout_exercise(
    'a5000000-0000-0000-0000-000000000005',
    'user_requested',
    null,
    array['ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid]
  )$$,
  'P0001',
  'Lista de exclusão contém exercício inválido',
  'unknown exclusion exercise IDs are rejected'
);
select lives_ok(
  $$select public.substitute_workout_exercise(
    'a5000000-0000-0000-0000-000000000005',
    'equipment_unavailable',
    (select id from public.equipment where slug = 'leg-press'),
    '{}'::uuid[]
  )$$,
  'A can perform a valid equipment substitution'
);
select isnt(
  (select actual_exercise_id from public.workout_session_exercises where id = 'a5000000-0000-0000-0000-000000000005'),
  (select id from public.exercises where slug = 'leg-press'),
  'valid substitution changes the actual exercise'
);
select ok(
  public.exercise_has_approved_primary((
    select actual_exercise_id
    from public.workout_session_exercises
    where id = 'a5000000-0000-0000-0000-000000000005'
  )),
  'runtime substitution selects a published media-ready exercise'
);
select is(
  (select available from public.user_equipment where user_id = 'a1000000-0000-0000-0000-000000000001' and equipment_id = (select id from public.equipment where slug = 'leg-press')),
  false,
  'valid equipment substitution records unavailability'
);
select is(
  (select count(*)::integer from public.workout_substitution_events where user_id = 'a1000000-0000-0000-0000-000000000001' and undone_at is null),
  1,
  'valid substitution creates one pending audit event'
);

select set_config('test.reject_equipment_restore', 'on', true);
select throws_ok(
  $$select public.undo_workout_substitution(
    (select id from public.workout_substitution_events where user_id = 'a1000000-0000-0000-0000-000000000001' and undone_at is null limit 1)
  )$$,
  'P0001',
  'forced equipment restoration failure',
  'undo reports a restoration failure'
);
select is(
  (select count(*)::integer from public.workout_substitution_events where user_id = 'a1000000-0000-0000-0000-000000000001' and undone_at is null),
  1,
  'failed undo does not mark the event undone'
);
select isnt(
  (select actual_exercise_id from public.workout_session_exercises where id = 'a5000000-0000-0000-0000-000000000005'),
  (select id from public.exercises where slug = 'leg-press'),
  'failed undo rolls back the exercise restoration'
);
select is(
  (select available from public.user_equipment where user_id = 'a1000000-0000-0000-0000-000000000001' and equipment_id = (select id from public.equipment where slug = 'leg-press')),
  false,
  'failed undo keeps equipment state unchanged'
);

select set_config('test.reject_equipment_restore', 'off', true);
select lives_ok(
  $$select public.undo_workout_substitution(
    (select id from public.workout_substitution_events where user_id = 'a1000000-0000-0000-0000-000000000001' and undone_at is null limit 1)
  )$$,
  'valid undo completes atomically'
);
select is(
  (select actual_exercise_id from public.workout_session_exercises where id = 'a5000000-0000-0000-0000-000000000005'),
  (select id from public.exercises where slug = 'leg-press'),
  'valid undo restores the original exercise'
);
select is(
  (select available from public.user_equipment where user_id = 'a1000000-0000-0000-0000-000000000001' and equipment_id = (select id from public.equipment where slug = 'leg-press')),
  true,
  'valid undo restores prior equipment availability'
);
select is(
  (select count(*)::integer from public.workout_substitution_events where user_id = 'a1000000-0000-0000-0000-000000000001' and undone_at is not null),
  1,
  'valid undo marks the audit event undone last'
);
select is(
  (select count(*)::integer from public.user_equipment where user_id = 'b2000000-0000-0000-0000-000000000002' and not available),
  0,
  'A attacks do not change B equipment rows'
);
select isnt(
  (select actual_exercise_id from public.workout_session_exercises where id = 'b6000000-0000-0000-0000-000000000006'),
  (select id from public.exercises where slug = 'leg-press'),
  'A attacks do not revert B valid substitution'
);

select * from finish();
rollback;
