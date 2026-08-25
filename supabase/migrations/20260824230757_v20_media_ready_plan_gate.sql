-- VM Training v2.0: keep catalog activation independent from media readiness,
-- while making active plans and live substitutions fail closed on media.

create index if not exists gym_equipment_presets_equipment_id_idx
  on public.gym_equipment_presets(equipment_id);
create index if not exists workout_substitution_events_equipment_id_idx
  on public.workout_substitution_events(equipment_id);
create index if not exists workout_substitution_events_from_exercise_id_idx
  on public.workout_substitution_events(from_exercise_id);
create index if not exists workout_substitution_events_session_exercise_id_idx
  on public.workout_substitution_events(session_exercise_id);
create index if not exists workout_substitution_events_to_exercise_id_idx
  on public.workout_substitution_events(to_exercise_id);

create or replace function public.prevent_primary_media_regression()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  affected_exercise uuid := case when tg_op = 'DELETE' then old.exercise_id else new.exercise_id end;
  removed_primary boolean := old.status = 'approved'
    and old.execution_quality = 'approved'
    and old.media_role = 'PRIMARY_DEMO'
    and old.is_primary;
begin
  if removed_primary
     and (tg_op = 'DELETE' or new.status <> 'approved'
       or new.execution_quality <> 'approved'
       or new.media_role is distinct from 'PRIMARY_DEMO'
       or not new.is_primary)
     and exists (
       select 1
       from public.workout_plans plan
       join public.workout_days day on day.workout_plan_id = plan.id
       join public.workout_day_exercises item on item.workout_day_id = day.id
       where plan.status = 'active' and item.exercise_id = affected_exercise
     )
     and not public.exercise_has_approved_primary(affected_exercise) then
    raise exception 'PRIMARY_DEMO usada por plano ativo não pode regredir sem substituição aprovada';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists prevent_primary_media_regression_before_write
  on public.exercise_media;
drop trigger if exists active_plan_keeps_primary_media
  on public.exercise_media;
create constraint trigger active_plan_keeps_primary_media
after update or delete on public.exercise_media
deferrable initially deferred
for each row execute function public.prevent_primary_media_regression();

create or replace function public.enforce_session_exercise_media_ready()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or new.actual_exercise_id is distinct from old.actual_exercise_id)
     and exists (
       select 1
       from public.workout_sessions session
       join public.workout_plans plan on plan.id = session.workout_plan_id
       where session.id = new.workout_session_id
         and session.status = 'in_progress'
         and plan.status = 'active'
     )
     and not public.exercise_has_approved_primary(new.actual_exercise_id) then
    raise exception 'Substituição bloqueada: exercício sem PRIMARY_DEMO aprovada';
  end if;
  return new;
end;
$$;

drop trigger if exists session_exercise_requires_media
  on public.workout_session_exercises;
create trigger session_exercise_requires_media
before insert or update of actual_exercise_id on public.workout_session_exercises
for each row execute function public.enforce_session_exercise_media_ready();

create or replace function public.start_workout(p_workout_day_id uuid) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  new_session uuid;
  owning_plan uuid;
  total_exercises integer;
  media_ready_exercises integer;
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

  select count(distinct item.exercise_id),
    count(distinct item.exercise_id) filter (
      where public.exercise_has_approved_primary(item.exercise_id)
    )
  into total_exercises, media_ready_exercises
  from public.workout_days day
  join public.workout_day_exercises item on item.workout_day_id = day.id
  where day.workout_plan_id = owning_plan;

  if total_exercises = 0 or media_ready_exercises <> total_exercises then
    raise exception 'Plano ativo indisponível: cobertura visual incompleta (%/% prontos)',
      media_ready_exercises, total_exercises;
  end if;

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

revoke all on function public.prevent_primary_media_regression()
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function public.enforce_session_exercise_media_ready()
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function public.start_workout(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.start_workout(uuid) to authenticated;

comment on function public.enforce_session_exercise_media_ready() is
  'Keeps live substitutions media-ready without redefining exercises.active.';
