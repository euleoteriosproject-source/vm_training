alter table public.workout_sessions
  add column completion_percent numeric(5,2),
  add column planned_sets integer,
  add column completed_sets integer,
  add column planned_exercises integer,
  add column completed_exercises integer,
  add column total_volume_kg numeric(12,2),
  add column cancellation_reason text;

alter table public.workout_sessions
  add constraint workout_sessions_completion_percent_check
    check (completion_percent between 0 and 100),
  add constraint workout_sessions_planned_sets_check
    check (planned_sets is null or planned_sets >= 0),
  add constraint workout_sessions_completed_sets_check
    check (completed_sets is null or completed_sets >= 0),
  add constraint workout_sessions_planned_exercises_check
    check (planned_exercises is null or planned_exercises >= 0),
  add constraint workout_sessions_completed_exercises_check
    check (completed_exercises is null or completed_exercises >= 0),
  add constraint workout_sessions_total_volume_check
    check (total_volume_kg is null or total_volume_kg >= 0),
  add constraint workout_sessions_completion_counts_check
    check (
      (planned_sets is null or completed_sets is null or completed_sets <= planned_sets)
      and (planned_exercises is null or completed_exercises is null or completed_exercises <= planned_exercises)
    );

create unique index one_in_progress_workout_per_user
  on public.workout_sessions(user_id)
  where status = 'in_progress';

create or replace function public.start_workout(p_workout_day_id uuid) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  new_session uuid;
  owning_plan uuid;
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 18)
  );

  select session.id into new_session
  from public.workout_sessions session
  where session.user_id = current_user_id and session.status = 'in_progress'
  order by session.started_at desc
  limit 1;
  if new_session is not null then return new_session; end if;

  select plan.id into owning_plan
  from public.workout_days day
  join public.workout_plans plan on plan.id = day.workout_plan_id
  where day.id = p_workout_day_id
    and plan.user_id = current_user_id
    and plan.status = 'active';
  if owning_plan is null then raise exception 'Treino ativo não encontrado'; end if;

  insert into public.workout_sessions(user_id, workout_day_id, workout_plan_id)
  values(current_user_id, p_workout_day_id, owning_plan)
  returning id into new_session;

  insert into public.workout_session_exercises(
    workout_session_id, planned_exercise_id, actual_exercise_id, position
  )
  select new_session, item.exercise_id, item.exercise_id, item.position
  from public.workout_day_exercises item
  where item.workout_day_id = p_workout_day_id
  order by item.position;

  insert into public.set_logs(user_id, session_exercise_id, set_number)
  select current_user_id, session_exercise.id, number
  from public.workout_session_exercises session_exercise
  join public.workout_day_exercises planned
    on planned.workout_day_id = p_workout_day_id
    and planned.exercise_id = session_exercise.planned_exercise_id
    and planned.position = session_exercise.position
  cross join lateral generate_series(1, planned.target_sets) number
  where session_exercise.workout_session_id = new_session;

  return new_session;
end;
$$;

drop function public.finish_workout(uuid, text);

create function public.finish_workout(
  p_session_id uuid,
  p_notes text default null,
  p_confirm_partial boolean default false
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  session_row public.workout_sessions%rowtype;
  planned_set_count integer;
  completed_set_count integer;
  planned_exercise_count integer;
  completed_exercise_count integer;
  total_unit_count integer;
  completed_unit_count integer;
  completion numeric(5,2);
  volume numeric(12,2);
begin
  if current_user_id is null then
    raise exception 'Não autenticado';
  end if;

  select session.* into session_row
  from public.workout_sessions session
  where session.id = p_session_id
    and session.user_id = current_user_id
  for update;

  if not found then
    raise exception 'Treino não encontrado';
  end if;
  if session_row.status <> 'in_progress' then
    raise exception 'Este treino já foi encerrado';
  end if;

  select
    count(*) filter (where exercise.category <> 'cardio'),
    count(*) filter (where exercise.category <> 'cardio' and log.completed),
    coalesce(sum(
      case when exercise.category <> 'cardio' and log.completed
        then coalesce(log.weight_kg, 0) * coalesce(log.reps, 0)
        else 0 end
    ), 0)
  into planned_set_count, completed_set_count, volume
  from public.workout_session_exercises session_exercise
  join public.exercises exercise on exercise.id = session_exercise.actual_exercise_id
  left join public.set_logs log on log.session_exercise_id = session_exercise.id
  where session_exercise.workout_session_id = p_session_id;

  select
    count(*),
    count(*) filter (
      where case
        when exercise.category = 'cardio' then exists (
          select 1 from public.cardio_logs cardio
          where cardio.session_exercise_id = session_exercise.id
            and cardio.duration_seconds > 0
        )
        else exists (
          select 1 from public.set_logs exercise_set
          where exercise_set.session_exercise_id = session_exercise.id
        ) and not exists (
          select 1 from public.set_logs exercise_set
          where exercise_set.session_exercise_id = session_exercise.id
            and not exercise_set.completed
        )
      end
    ),
    count(*) filter (where exercise.category = 'cardio'),
    count(*) filter (
      where exercise.category = 'cardio' and exists (
        select 1 from public.cardio_logs cardio
        where cardio.session_exercise_id = session_exercise.id
          and cardio.duration_seconds > 0
      )
    )
  into planned_exercise_count, completed_exercise_count,
    total_unit_count, completed_unit_count
  from public.workout_session_exercises session_exercise
  join public.exercises exercise on exercise.id = session_exercise.actual_exercise_id
  where session_exercise.workout_session_id = p_session_id;

  total_unit_count := planned_set_count + total_unit_count;
  completed_unit_count := completed_set_count + completed_unit_count;

  if total_unit_count = 0 or completed_unit_count = 0 then
    raise exception 'Conclua pelo menos uma série ou atividade antes de encerrar';
  end if;

  completion := round((completed_unit_count::numeric / total_unit_count) * 100, 2);
  if completion < 100 and not p_confirm_partial then
    raise exception 'CONFIRM_PARTIAL:%:%:%:%',
      completed_set_count, planned_set_count,
      completed_exercise_count, planned_exercise_count;
  end if;

  update public.workout_session_exercises session_exercise
  set status = case
    when session_exercise.status = 'skipped' then 'skipped'
    when exists (
      select 1 from public.exercises exercise
      where exercise.id = session_exercise.actual_exercise_id
        and exercise.category = 'cardio'
        and exists (
          select 1 from public.cardio_logs cardio
          where cardio.session_exercise_id = session_exercise.id
            and cardio.duration_seconds > 0
        )
    ) or (
      exists (
        select 1 from public.set_logs exercise_set
        where exercise_set.session_exercise_id = session_exercise.id
      ) and not exists (
        select 1 from public.set_logs exercise_set
        where exercise_set.session_exercise_id = session_exercise.id
          and not exercise_set.completed
      )
    ) then 'completed'
    else 'pending'
  end,
  updated_at = now()
  where session_exercise.workout_session_id = p_session_id;

  update public.workout_sessions
  set status = 'completed',
      completed_at = now(),
      duration_seconds = greatest(0, extract(epoch from (now() - started_at))::integer),
      notes = nullif(btrim(p_notes), ''),
      completion_percent = completion,
      planned_sets = planned_set_count,
      completed_sets = completed_set_count,
      planned_exercises = planned_exercise_count,
      completed_exercises = completed_exercise_count,
      total_volume_kg = volume,
      cancellation_reason = null,
      updated_at = now()
  where id = p_session_id;

  return jsonb_build_object(
    'status', 'completed',
    'completionPercent', completion,
    'plannedSets', planned_set_count,
    'completedSets', completed_set_count,
    'plannedExercises', planned_exercise_count,
    'completedExercises', completed_exercise_count,
    'totalVolumeKg', volume
  );
end;
$$;

create function public.cancel_workout(
  p_session_id uuid,
  p_reason text default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  session_row public.workout_sessions%rowtype;
begin
  if current_user_id is null then
    raise exception 'Não autenticado';
  end if;

  select session.* into session_row
  from public.workout_sessions session
  where session.id = p_session_id
    and session.user_id = current_user_id
  for update;

  if not found then
    raise exception 'Treino não encontrado';
  end if;
  if session_row.status <> 'in_progress' then
    raise exception 'Este treino já foi encerrado';
  end if;

  update public.workout_sessions
  set status = 'cancelled',
      completed_at = null,
      duration_seconds = greatest(0, extract(epoch from (now() - started_at))::integer),
      cancellation_reason = nullif(btrim(p_reason), ''),
      updated_at = now()
  where id = p_session_id;

  return jsonb_build_object('status', 'cancelled');
end;
$$;

revoke all on function public.finish_workout(uuid, text, boolean)
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function public.cancel_workout(uuid, text)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.finish_workout(uuid, text, boolean) to authenticated;
grant execute on function public.cancel_workout(uuid, text) to authenticated;

comment on column public.workout_sessions.completion_percent is
  'Server-calculated completion snapshot. NULL marks sessions closed before v1.8.';
comment on function public.finish_workout(uuid, text, boolean) is
  'Atomically calculates completion and blocks empty or unconfirmed partial workouts.';
comment on function public.cancel_workout(uuid, text) is
  'Cancels an owned in-progress workout without classifying it as completed.';
