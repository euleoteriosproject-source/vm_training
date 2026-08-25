begin;
grant usage on schema extensions to anon, authenticated, service_role;
set local search_path = public, extensions;
select plan(15);

select has_function(
  'public', 'finish_workout', array['uuid', 'text', 'boolean'],
  'atomic finish RPC exists'
);
select has_function(
  'public', 'cancel_workout', array['uuid', 'text'],
  'cancel RPC exists'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.finish_workout(uuid,text,boolean)'::regprocedure),
  false,
  'finish RPC is SECURITY INVOKER'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.cancel_workout(uuid,text)'::regprocedure),
  false,
  'cancel RPC is SECURITY INVOKER'
);
select ok(
  has_function_privilege('authenticated', 'public.finish_workout(uuid,text,boolean)', 'execute')
  and not has_function_privilege('anon', 'public.finish_workout(uuid,text,boolean)', 'execute'),
  'only authenticated can call finish RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.cancel_workout(uuid,text)', 'execute')
  and not has_function_privilege('anon', 'public.cancel_workout(uuid,text)', 'execute'),
  'only authenticated can call cancel RPC'
);

insert into public.allowed_signup_emails(email, display_name, default_role)
values
  ('completion-a@example.test', 'Completion A', 'member'),
  ('completion-b@example.test', 'Completion B', 'member')
on conflict do nothing;

insert into auth.users(
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
)
values
  ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'completion-a@example.test', 'x', now(), now(), now()),
  ('c2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'completion-b@example.test', 'x', now(), now(), now());

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

insert into public.workout_sessions(id, user_id, status)
values ('c3000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 'in_progress');

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
  values ('c5000000-0000-0000-0000-000000000005'::uuid, 'c3000000-0000-0000-0000-000000000003'::uuid)
) fixture(session_exercise_id, session_id)
join public.exercises exercise on exercise.slug = 'leg-press';

insert into public.set_logs(id, user_id, session_exercise_id, set_number)
values
  ('c7000000-0000-0000-0000-000000000007', 'c1000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000005', 1),
  ('c8000000-0000-0000-0000-000000000008', 'c1000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000005', 2);

select throws_ok(
  $$select public.finish_workout('c3000000-0000-0000-0000-000000000003', null, false)$$,
  'P0001',
  'Conclua pelo menos uma série ou atividade antes de encerrar',
  'zero-percent workout cannot finish'
);

update public.set_logs
set completed = true, completed_at = now(), weight_kg = 10, reps = 8
where id = 'c7000000-0000-0000-0000-000000000007';

select throws_ok(
  $$select public.finish_workout('c3000000-0000-0000-0000-000000000003', null, false)$$,
  'P0001',
  'CONFIRM_PARTIAL:1:2:0:1',
  'partial workout requires explicit confirmation'
);
select is(
  public.finish_workout('c3000000-0000-0000-0000-000000000003', '  observação  ', true)->>'status',
  'completed',
  'confirmed partial workout finishes'
);
select is(
  (select completion_percent from public.workout_sessions where id = 'c3000000-0000-0000-0000-000000000003'),
  50.00::numeric,
  'completion percentage is calculated on the server'
);
select is(
  (select completed_sets::text || '/' || planned_sets::text from public.workout_sessions where id = 'c3000000-0000-0000-0000-000000000003'),
  '1/2',
  'set snapshot is persisted'
);
select is(
  (select total_volume_kg from public.workout_sessions where id = 'c3000000-0000-0000-0000-000000000003'),
  80.00::numeric,
  'completed-set volume is persisted'
);

insert into public.workout_sessions(id, user_id, status)
values ('c4000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001', 'in_progress');
insert into public.workout_session_exercises(
  id, workout_session_id, planned_exercise_id, actual_exercise_id, position
)
select
  'c6000000-0000-0000-0000-000000000006',
  'c4000000-0000-0000-0000-000000000004',
  exercise.id,
  exercise.id,
  1
from public.exercises exercise where exercise.slug = 'leg-press';

select is(
  public.cancel_workout('c4000000-0000-0000-0000-000000000004', 'sem tempo')->>'status',
  'cancelled',
  'in-progress workout can be cancelled separately'
);
select ok(
  (select status = 'cancelled' and completed_at is null and cancellation_reason = 'sem tempo'
   from public.workout_sessions where id = 'c4000000-0000-0000-0000-000000000004'),
  'cancelled workout is not classified as completed'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c2000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
select throws_ok(
  $$select public.cancel_workout('c4000000-0000-0000-0000-000000000004', null)$$,
  'P0001',
  'Treino não encontrado',
  'another user cannot act on an owned workout'
);

select * from finish();
rollback;
