-- VM Training v1.7.1: keep the public Data API as SECURITY INVOKER while
-- moving the privileged, atomic substitution workflow into the unexposed
-- private schema.

alter table public.workout_substitution_events
  add column if not exists equipment_previous_temporary_unavailable_until timestamptz;

create or replace function private.substitute_workout_exercise_internal(
  p_session_exercise_id uuid,
  p_reason text,
  p_equipment_id uuid default null,
  p_exclude_exercise_ids uuid[] default '{}'::uuid[]
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_exercise_id uuid;
  replacement_id uuid;
  replacement_name text;
  event_id uuid;
  previous_equipment public.user_equipment%rowtype;
  equipment_had_row boolean := false;
  excluded_ids uuid[] := coalesce(p_exclude_exercise_ids, '{}'::uuid[]);
begin
  if current_user_id is null then
    raise exception 'Não autenticado';
  end if;
  if p_session_exercise_id is null then
    raise exception 'Exercício da sessão inválido';
  end if;
  if p_reason not in (
    'equipment_unavailable',
    'temporarily_unavailable',
    'user_requested'
  ) then
    raise exception 'Motivo de substituição inválido';
  end if;
  if cardinality(excluded_ids) > 50 or array_position(excluded_ids, null) is not null then
    raise exception 'Lista de exclusão inválida';
  end if;
  if exists (
    select 1
    from unnest(excluded_ids) excluded(exercise_id)
    left join public.exercises exercise on exercise.id = excluded.exercise_id
    where exercise.id is null
  ) then
    raise exception 'Lista de exclusão contém exercício inválido';
  end if;

  select session_exercise.actual_exercise_id
  into current_exercise_id
  from public.workout_session_exercises session_exercise
  join public.workout_sessions session
    on session.id = session_exercise.workout_session_id
  where session_exercise.id = p_session_exercise_id
    and session.user_id = current_user_id
    and session.status = 'in_progress'
  for update of session_exercise;

  if current_exercise_id is null then
    raise exception 'Exercício da sessão não encontrado';
  end if;

  if p_reason = 'equipment_unavailable' then
    if p_equipment_id is null or not exists (
      select 1
      from public.exercise_equipment link
      where link.exercise_id = current_exercise_id
        and link.equipment_id = p_equipment_id
        and link.required
    ) then
      raise exception 'Equipamento não pertence ao exercício atual';
    end if;

    select *
    into previous_equipment
    from public.user_equipment
    where user_id = current_user_id
      and equipment_id = p_equipment_id;
    equipment_had_row := found;

    insert into public.user_equipment(
      user_id,
      equipment_id,
      available,
      source,
      temporary_unavailable_until
    )
    values(current_user_id, p_equipment_id, false, 'user_override', null)
    on conflict(user_id, equipment_id) do update set
      available = false,
      source = 'user_override',
      temporary_unavailable_until = null,
      updated_at = now();
  elsif p_equipment_id is not null then
    raise exception 'Equipamento não deve ser informado para este motivo';
  end if;

  with source_exercise as (
    select *
    from public.exercises
    where id = current_exercise_id
  ), candidates as (
    select
      candidate.id,
      candidate.name_pt,
      coalesce(explicit.score, 0)
      + case when candidate.movement_pattern = source.movement_pattern then 45 else 0 end
      + case when candidate.primary_muscles && source.primary_muscles then 30 else 0 end
      + case when candidate.difficulty = source.difficulty then 10 else 0 end
      - case
          when exists (
            select 1
            from public.user_movement_attention attention
            where attention.user_id = current_user_id
              and attention.active
              and (
                (attention.region = 'knee' and candidate.movement_pattern in ('squat','knee_extension','knee_flexion'))
                or (attention.region = 'shoulder' and candidate.movement_pattern in ('horizontal_push','vertical_push'))
                or (attention.region = 'lower_back' and candidate.movement_pattern in ('hinge','core_flexion'))
                or (attention.region = 'hip' and candidate.movement_pattern in ('squat','hinge','hip_extension'))
              )
          ) then 25
          else 0
        end as rank_score
    from source_exercise source
    join public.exercises candidate
      on candidate.active
      and candidate.id <> source.id
    left join public.exercise_substitutions explicit
      on explicit.exercise_id = source.id
      and explicit.alternative_exercise_id = candidate.id
    where not (candidate.id = any(excluded_ids))
      and not exists (
        select 1
        from public.exercise_equipment required_link
        join public.equipment equipment
          on equipment.id = required_link.equipment_id
        where required_link.exercise_id = candidate.id
          and required_link.required
          and equipment.slug <> 'bodyweight'
          and not exists (
            select 1
            from public.user_equipment available_equipment
            where available_equipment.user_id = current_user_id
              and available_equipment.equipment_id = required_link.equipment_id
              and available_equipment.available
              and (
                available_equipment.temporary_unavailable_until is null
                or available_equipment.temporary_unavailable_until <= now()
              )
          )
      )
  )
  select id, name_pt
  into replacement_id, replacement_name
  from candidates
  order by rank_score desc, name_pt
  limit 1;

  if replacement_id is null then
    raise exception 'Nenhuma substituição compatível disponível';
  end if;

  update public.workout_session_exercises
  set
    actual_exercise_id = replacement_id,
    substitution_reason = p_reason,
    updated_at = now()
  where id = p_session_exercise_id;

  if not found then
    raise exception 'Exercício da sessão não encontrado';
  end if;

  insert into public.workout_substitution_events(
    user_id,
    session_exercise_id,
    from_exercise_id,
    to_exercise_id,
    reason,
    equipment_id,
    equipment_had_row,
    equipment_previous_available,
    equipment_previous_source,
    equipment_previous_temporary_unavailable_until
  )
  values(
    current_user_id,
    p_session_exercise_id,
    current_exercise_id,
    replacement_id,
    p_reason,
    p_equipment_id,
    equipment_had_row,
    previous_equipment.available,
    previous_equipment.source,
    previous_equipment.temporary_unavailable_until
  )
  returning id into event_id;

  return jsonb_build_object(
    'eventId', event_id,
    'exerciseId', replacement_id,
    'exerciseName', replacement_name
  );
end;
$$;

create or replace function private.undo_workout_substitution_internal(
  p_event_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  substitution_event public.workout_substitution_events%rowtype;
  restored_name text;
begin
  if current_user_id is null then
    raise exception 'Não autenticado';
  end if;
  if p_event_id is null then
    raise exception 'Substituição inválida';
  end if;

  select *
  into substitution_event
  from public.workout_substitution_events event
  where event.id = p_event_id
    and event.user_id = current_user_id
    and event.undone_at is null
  for update;

  if not found then
    raise exception 'Substituição não encontrada ou já desfeita';
  end if;

  if exists (
    select 1
    from public.workout_substitution_events newer_event
    where newer_event.session_exercise_id = substitution_event.session_exercise_id
      and newer_event.user_id = current_user_id
      and newer_event.undone_at is null
      and (
        newer_event.created_at > substitution_event.created_at
        or (
          newer_event.created_at = substitution_event.created_at
          and newer_event.id > substitution_event.id
        )
      )
  ) then
    raise exception 'Desfaça primeiro a substituição mais recente';
  end if;

  update public.workout_session_exercises session_exercise
  set
    actual_exercise_id = substitution_event.from_exercise_id,
    substitution_reason = null,
    updated_at = now()
  from public.workout_sessions session
  where session_exercise.id = substitution_event.session_exercise_id
    and session.id = session_exercise.workout_session_id
    and session.user_id = current_user_id
    and session.status = 'in_progress';

  if not found then
    raise exception 'Sessão não está disponível para desfazer';
  end if;

  if substitution_event.reason = 'equipment_unavailable'
     and substitution_event.equipment_id is not null then
    if substitution_event.equipment_had_row then
      update public.user_equipment
      set
        available = substitution_event.equipment_previous_available,
        source = substitution_event.equipment_previous_source,
        temporary_unavailable_until =
          substitution_event.equipment_previous_temporary_unavailable_until,
        updated_at = now()
      where user_id = current_user_id
        and equipment_id = substitution_event.equipment_id;

      if not found then
        raise exception 'Equipamento não pôde ser restaurado';
      end if;
    else
      delete from public.user_equipment
      where user_id = current_user_id
        and equipment_id = substitution_event.equipment_id;
    end if;
  end if;

  update public.workout_substitution_events
  set undone_at = now()
  where id = p_event_id
    and user_id = current_user_id
    and undone_at is null;

  if not found then
    raise exception 'Substituição não pôde ser desfeita';
  end if;

  select exercise.name_pt
  into restored_name
  from public.exercises exercise
  where exercise.id = substitution_event.from_exercise_id;

  return jsonb_build_object(
    'exerciseId', substitution_event.from_exercise_id,
    'exerciseName', restored_name
  );
end;
$$;

create or replace function public.substitute_workout_exercise(
  p_session_exercise_id uuid,
  p_reason text,
  p_equipment_id uuid default null,
  p_exclude_exercise_ids uuid[] default '{}'::uuid[]
) returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.substitute_workout_exercise_internal($1, $2, $3, $4);
$$;

create or replace function public.undo_workout_substitution(
  p_event_id uuid
) returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.undo_workout_substitution_internal($1);
$$;

revoke all on function private.substitute_workout_exercise_internal(uuid,text,uuid,uuid[])
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function private.substitute_workout_exercise_internal(uuid,text,uuid,uuid[])
  to authenticated;

revoke all on function private.undo_workout_substitution_internal(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function private.undo_workout_substitution_internal(uuid)
  to authenticated;

revoke all on function public.substitute_workout_exercise(uuid,text,uuid,uuid[])
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.substitute_workout_exercise(uuid,text,uuid,uuid[])
  to authenticated;

revoke all on function public.undo_workout_substitution(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.undo_workout_substitution(uuid)
  to authenticated;

comment on function public.substitute_workout_exercise(uuid,text,uuid,uuid[])
  is 'SECURITY INVOKER Data API wrapper for the private atomic substitution workflow.';
comment on function public.undo_workout_substitution(uuid)
  is 'SECURITY INVOKER Data API wrapper for the private atomic undo workflow.';
