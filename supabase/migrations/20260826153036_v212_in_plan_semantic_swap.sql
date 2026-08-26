-- VM Training v2.1.2: semantic in-plan exercise replacement, versioned plan
-- edits, reversible changes, and previewed non-equivalent rebalancing.

begin;

alter table public.exercises
  add column if not exists training_role text;

update public.exercises
set training_role = case
  when category = 'cardio' then 'conditioning'
  when category = 'mobility' then 'mobility'
  when movement_pattern = 'posture' then 'postural_control'
  when movement_pattern in ('core_anti_extension','core_anti_rotation') then 'core_stability'
  when movement_pattern = 'core_flexion' then 'trunk_flexion'
  else movement_pattern
end
where training_role is null;

create or replace function private.assign_exercise_training_role_v212()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.training_role is null then
    new.training_role := case
      when new.category = 'cardio' then 'conditioning'
      when new.category = 'mobility' then 'mobility'
      when new.movement_pattern = 'posture' then 'postural_control'
      when new.movement_pattern in ('core_anti_extension','core_anti_rotation')
        then 'core_stability'
      when new.movement_pattern = 'core_flexion' then 'trunk_flexion'
      else new.movement_pattern
    end;
  end if;
  return new;
end;
$$;

revoke all on function private.assign_exercise_training_role_v212()
  from public, anon, authenticated, service_role, supabase_auth_admin;

drop trigger if exists assign_exercise_training_role_v212 on public.exercises;
create trigger assign_exercise_training_role_v212
before insert or update of category, movement_pattern, training_role
on public.exercises for each row
execute function private.assign_exercise_training_role_v212();

alter table public.exercises alter column training_role set not null;

create table public.plan_exercise_change_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_plan_id uuid not null references public.workout_plans(id) on delete restrict,
  resulting_plan_id uuid not null references public.workout_plans(id) on delete restrict,
  source_slot_id uuid not null references public.workout_day_exercises(id) on delete restrict,
  resulting_slot_id uuid references public.workout_day_exercises(id) on delete restrict,
  from_exercise_id uuid not null references public.exercises(id) on delete restrict,
  to_exercise_id uuid not null references public.exercises(id) on delete restrict,
  change_type text not null check (change_type in ('equivalent','rebalance')),
  changes jsonb not null default '[]'::jsonb,
  persistent_exclusion boolean not null default false,
  preference_had_row boolean not null default false,
  preference_previous_value text,
  undone_at timestamptz,
  created_at timestamptz not null default now(),
  check (source_plan_id <> resulting_plan_id),
  check (from_exercise_id <> to_exercise_id)
);

create index plan_exercise_change_events_user_created_idx
  on public.plan_exercise_change_events(user_id, created_at desc);

alter table public.plan_exercise_change_events enable row level security;
create policy "own plan exercise changes read"
  on public.plan_exercise_change_events for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all privileges on table public.plan_exercise_change_events
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant select on table public.plan_exercise_change_events to authenticated;
grant select, insert, update, delete on table public.plan_exercise_change_events
  to service_role;

create or replace function private.exercises_are_semantically_equivalent_v212(
  p_source_exercise_id uuid,
  p_candidate_exercise_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.exercises source
    join public.exercises candidate on candidate.id = p_candidate_exercise_id
    where source.id = p_source_exercise_id
      and source.id <> candidate.id
      and source.category = candidate.category
      and source.movement_pattern = candidate.movement_pattern
      and source.training_role = candidate.training_role
      and source.primary_muscles && candidate.primary_muscles
  );
$$;

revoke all on function private.exercises_are_semantically_equivalent_v212(uuid,uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;

create or replace function private.plan_replacement_candidates_v212(
  p_workout_day_exercise_id uuid,
  p_query text default null,
  p_limit integer default 5,
  p_offset integer default 0
)
returns table (
  exercise_id uuid,
  exercise_name text,
  movement_pattern text,
  training_role text,
  category text,
  difficulty text,
  primary_muscles text[],
  secondary_muscles text[],
  equipment_names text[],
  equipment_slugs text[],
  media_storage_path text,
  media_poster_path text,
  media_type text,
  is_equivalent boolean,
  reason text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_query text := nullif(btrim(p_query), '');
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  if p_limit not between 1 and 20 or p_offset < 0 then
    raise exception 'Paginação inválida';
  end if;
  if not exists (
    select 1
    from public.workout_day_exercises slot
    join public.workout_days day on day.id = slot.workout_day_id
    join public.workout_plans plan on plan.id = day.workout_plan_id
    where slot.id = p_workout_day_exercise_id
      and plan.user_id = current_user_id
      and plan.status = 'active'
  ) then raise exception 'Slot de plano ativo não encontrado'; end if;

  return query
  with source_context as (
    select source.*, day.workout_plan_id, day.id day_id,
      coalesce(plan.goal_code, goal.goal_code, 'general_health') selected_goal
    from public.workout_day_exercises slot
    join public.workout_days day on day.id = slot.workout_day_id
    join public.workout_plans plan on plan.id = day.workout_plan_id
    join public.exercises source on source.id = slot.exercise_id
    left join lateral (
      select user_goal.goal_code
      from public.user_goals user_goal
      where user_goal.user_id = current_user_id and user_goal.active
      order by user_goal.priority, user_goal.goal_code limit 1
    ) goal on true
    where slot.id = p_workout_day_exercise_id
      and plan.user_id = current_user_id
      and plan.status = 'active'
  ), ranked as (
    select candidate.id, candidate.name_pt, candidate.movement_pattern,
      candidate.training_role, candidate.category, candidate.difficulty,
      candidate.primary_muscles, candidate.secondary_muscles,
      private.exercises_are_semantically_equivalent_v212(source.id, candidate.id)
        equivalent,
      coalesce(explicit.score, 0)
        + case when candidate.movement_pattern = source.movement_pattern then 60 else 0 end
        + case when candidate.training_role = source.training_role then 30 else 0 end
        + case when candidate.primary_muscles && source.primary_muscles then 20 else 0 end
        + case when candidate.secondary_muscles && source.secondary_muscles then 5 else 0 end
        + case when candidate.difficulty = source.difficulty then 8 else 0 end
        + case
            when source.selected_goal = 'strength' and candidate.category = 'strength' then 6
            when source.selected_goal = 'muscle_gain' and candidate.category = 'strength' then 6
            when source.selected_goal in ('conditioning','cardio_endurance','fat_loss','weight_loss','measurements')
              and candidate.category = 'cardio' then 6
            when source.selected_goal in ('mobility','posture')
              and (candidate.category = 'mobility' or candidate.movement_pattern = 'posture') then 6
            else 0
          end as rank_score,
      source.workout_plan_id
    from source_context source
    join public.exercises candidate on candidate.id <> source.id
    left join public.exercise_substitutions explicit
      on explicit.exercise_id = source.id
      and explicit.alternative_exercise_id = candidate.id
    where candidate.active
      and private.exercise_media_is_ready(candidate.id)
      and private.exercise_auto_plan_eligible(candidate.id, current_user_id)
      and (
        normalized_query is not null
        or private.exercises_are_semantically_equivalent_v212(source.id, candidate.id)
      )
      and (
        normalized_query is null
        or candidate.name_pt ilike '%' || normalized_query || '%'
        or candidate.slug ilike '%' || normalized_query || '%'
        or exists (
          select 1 from unnest(candidate.primary_muscles || candidate.secondary_muscles) muscle
          where muscle ilike '%' || normalized_query || '%'
        )
      )
      and not exists (
        select 1
        from public.workout_days existing_day
        join public.workout_day_exercises existing_slot
          on existing_slot.workout_day_id = existing_day.id
        where existing_day.workout_plan_id = source.workout_plan_id
          and existing_slot.exercise_id = candidate.id
      )
  ), hydrated as (
    select ranked.*,
      coalesce((
        select array_agg(equipment.name order by equipment.name)
        from public.exercise_equipment link
        join public.equipment equipment on equipment.id = link.equipment_id
        where link.exercise_id = ranked.id and link.required
      ), '{}'::text[]) equipment_names,
      coalesce((
        select array_agg(equipment.slug order by equipment.slug)
        from public.exercise_equipment link
        join public.equipment equipment on equipment.id = link.equipment_id
        where link.exercise_id = ranked.id and link.required
      ), '{}'::text[]) equipment_slugs,
      media.storage_path, media.poster_path, media.media_type
    from ranked
    join lateral (
      select approved.storage_path, approved.poster_path, approved.media_type
      from public.exercise_media approved
      where approved.exercise_id = ranked.id
        and approved.status = 'approved'
        and approved.execution_quality = 'approved'
        and approved.media_role = 'PRIMARY_DEMO'
        and approved.is_primary
        and approved.review_state = 'PUBLISHED'
      order by approved.sort_order, approved.id limit 1
    ) media on true
  ), counted as (
    select hydrated.*, count(*) over() candidate_count
    from hydrated
  )
  select counted.id, counted.name_pt, counted.movement_pattern,
    counted.training_role, counted.category, counted.difficulty,
    counted.primary_muscles, counted.secondary_muscles,
    counted.equipment_names, counted.equipment_slugs,
    counted.storage_path, counted.poster_path, counted.media_type,
    counted.equivalent,
    case
      when not counted.equivalent then 'Função diferente no treino'
      when counted.movement_pattern = 'horizontal_push' then 'Mesmo padrão de empurrar horizontal'
      when counted.movement_pattern = 'vertical_push' then 'Mesmo padrão de empurrar vertical'
      when counted.movement_pattern = 'horizontal_pull' then 'Mesmo padrão de puxar horizontal'
      when counted.movement_pattern = 'vertical_pull' then 'Mesmo padrão de puxar vertical'
      when counted.movement_pattern = 'knee_flexion' then 'Mesmo foco em posteriores de coxa'
      when counted.movement_pattern = 'posture' then 'Mesma função de controle postural'
      when counted.movement_pattern = 'mobility' then 'Mesma função de mobilidade'
      else 'Mesmo padrão e função no treino'
    end,
    counted.candidate_count
  from counted
  order by counted.equivalent desc, counted.rank_score desc,
    counted.name_pt, counted.id
  limit p_limit offset p_offset;
end;
$$;

revoke all on function private.plan_replacement_candidates_v212(uuid,text,integer,integer)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function private.plan_replacement_candidates_v212(uuid,text,integer,integer)
  to authenticated;

create or replace function public.get_plan_replacement_candidates_v212(
  p_workout_day_exercise_id uuid,
  p_query text default null,
  p_limit integer default 5,
  p_offset integer default 0
)
returns table (
  exercise_id uuid,
  exercise_name text,
  movement_pattern text,
  training_role text,
  category text,
  difficulty text,
  primary_muscles text[],
  secondary_muscles text[],
  equipment_names text[],
  equipment_slugs text[],
  media_storage_path text,
  media_poster_path text,
  media_type text,
  is_equivalent boolean,
  reason text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.plan_replacement_candidates_v212($1, $2, $3, $4);
$$;

revoke all on function public.get_plan_replacement_candidates_v212(uuid,text,integer,integer)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.get_plan_replacement_candidates_v212(uuid,text,integer,integer)
  to authenticated;

create or replace function private.clone_plan_v212(
  p_source_plan_id uuid,
  p_user_id uuid,
  p_rationale jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  cloned_plan_id uuid;
  cloned_day_id uuid;
  source_day record;
begin
  insert into public.workout_plans(
    user_id, name, status, source, sessions_per_week, target_session_minutes,
    generator_version, quality_metrics, generation_rationale, goal_code
  )
  select p_user_id, plan.name, 'draft', plan.source, plan.sessions_per_week,
    plan.target_session_minutes, 'v2.1.2', '{}'::jsonb,
    coalesce(plan.generation_rationale, '{}'::jsonb) || coalesce(p_rationale, '{}'::jsonb),
    plan.goal_code
  from public.workout_plans plan
  where plan.id = p_source_plan_id and plan.user_id = p_user_id
  returning id into cloned_plan_id;

  if cloned_plan_id is null then raise exception 'Plano não encontrado'; end if;

  for source_day in
    select day.* from public.workout_days day
    where day.workout_plan_id = p_source_plan_id order by day.position
  loop
    insert into public.workout_days(
      workout_plan_id, name, position, estimated_minutes
    ) values (
      cloned_plan_id, source_day.name, source_day.position, source_day.estimated_minutes
    ) returning id into cloned_day_id;

    insert into public.workout_day_exercises(
      workout_day_id, exercise_id, position, target_sets, rep_min, rep_max,
      target_duration_seconds, rest_seconds, target_rpe, target_rir, notes
    )
    select cloned_day_id, item.exercise_id, item.position, item.target_sets,
      item.rep_min, item.rep_max, item.target_duration_seconds,
      item.rest_seconds, item.target_rpe, item.target_rir, item.notes
    from public.workout_day_exercises item
    where item.workout_day_id = source_day.id
    order by item.position;
  end loop;

  return cloned_plan_id;
end;
$$;

revoke all on function private.clone_plan_v212(uuid,uuid,jsonb)
  from public, anon, authenticated, service_role, supabase_auth_admin;

create or replace function private.assert_plan_quality_v212(p_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_plan public.workout_plans%rowtype;
  quality jsonb;
  goal_alignment jsonb;
begin
  select * into selected_plan from public.workout_plans where id = p_plan_id;
  if not found then raise exception 'Plano não encontrado'; end if;

  quality := private.calculate_plan_quality(p_plan_id);
  goal_alignment := private.calculate_goal_alignment_v211(p_plan_id);
  quality := quality || jsonb_build_object('goalAlignment', goal_alignment);

  if coalesce((quality->>'totalSlots')::integer, 0) = 0
     or coalesce((quality->>'mediaCoveragePercent')::numeric, 0) <> 100
     or jsonb_array_length(quality->'ineligibleExercises') <> 0
     or jsonb_array_length(quality->'invalidEquipment') <> 0 then
    raise exception 'Plano v2.1.2 falhou nos gates de mídia, equipamento ou elegibilidade';
  end if;
  if goal_alignment->>'status' <> 'PASS' then
    raise exception 'Plano v2.1.2 falhou no alinhamento ao objetivo';
  end if;
  if selected_plan.sessions_per_week = 3
     and selected_plan.target_session_minutes = 60
     and (
       coalesce((quality->>'totalSlots')::integer, 0) <> 18
       or coalesce((quality->>'uniqueExercises')::integer, 0) < 12
       or coalesce((quality->>'maxExactExerciseFrequency')::integer, 0) > 2
       or jsonb_array_length(quality->'exactExerciseOnAllDays') <> 0
       or coalesce((quality->>'maxDayPairOverlapPercent')::numeric, 100) > 50
       or coalesce((quality->>'movementPatternCount')::integer, 0) < 8
     ) then
    raise exception 'Plano v2.1.2 falhou nos gates de diversidade';
  end if;

  return quality;
end;
$$;

revoke all on function private.assert_plan_quality_v212(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;

create or replace function private.replace_plan_exercise_v212_internal(
  p_workout_day_exercise_id uuid,
  p_replacement_exercise_id uuid,
  p_persist_exclusion boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  source_context record;
  replacement_name text;
  cloned_plan_id uuid;
  cloned_day_id uuid;
  cloned_slot_id uuid;
  event_id uuid;
  quality jsonb;
  previous_preference public.user_exercise_preferences%rowtype;
  preference_had_row boolean := false;
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  if p_replacement_exercise_id is null then raise exception 'Substituição inválida'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 212)
  );

  select plan.id plan_id, day.id day_id, day.position day_position,
    slot.position slot_position, slot.exercise_id source_exercise_id,
    source.name_pt source_name
  into source_context
  from public.workout_day_exercises slot
  join public.workout_days day on day.id = slot.workout_day_id
  join public.workout_plans plan on plan.id = day.workout_plan_id
  join public.exercises source on source.id = slot.exercise_id
  where slot.id = p_workout_day_exercise_id
    and plan.user_id = current_user_id and plan.status = 'active'
  for update of plan;

  if not found then raise exception 'Slot de plano ativo não encontrado'; end if;
  if not private.exercises_are_semantically_equivalent_v212(
    source_context.source_exercise_id, p_replacement_exercise_id
  ) then raise exception 'Esse exercício tem uma função diferente no treino'; end if;
  if not private.exercise_media_is_ready(p_replacement_exercise_id)
     or not private.exercise_auto_plan_eligible(
       p_replacement_exercise_id, current_user_id
     ) then raise exception 'Exercício indisponível para este plano'; end if;
  if exists (
    select 1 from public.workout_days day
    join public.workout_day_exercises slot on slot.workout_day_id = day.id
    where day.workout_plan_id = source_context.plan_id
      and slot.exercise_id = p_replacement_exercise_id
  ) then raise exception 'Este exercício já faz parte do plano'; end if;

  select exercise.name_pt into replacement_name
  from public.exercises exercise
  where exercise.id = p_replacement_exercise_id and exercise.active;
  if replacement_name is null then raise exception 'Exercício não encontrado'; end if;

  if p_persist_exclusion and (
    select count(*) from public.workout_days day
    join public.workout_day_exercises slot on slot.workout_day_id = day.id
    where day.workout_plan_id = source_context.plan_id
      and slot.exercise_id = source_context.source_exercise_id
  ) > 1 then
    raise exception 'Este exercício aparece em outros dias; reorganize o plano para excluí-lo por completo';
  end if;

  select * into previous_preference
  from public.user_exercise_preferences preference
  where preference.user_id = current_user_id
    and preference.exercise_id = source_context.source_exercise_id;
  preference_had_row := found;

  if p_persist_exclusion then
    insert into public.user_exercise_preferences(user_id, exercise_id, preference)
    values(current_user_id, source_context.source_exercise_id, 'avoid')
    on conflict(user_id, exercise_id) do update set
      preference = 'avoid', updated_at = now();
  end if;

  cloned_plan_id := private.clone_plan_v212(
    source_context.plan_id,
    current_user_id,
    jsonb_build_object('v212Change', jsonb_build_object(
      'type', 'equivalent',
      'sourcePlanId', source_context.plan_id,
      'sourceSlotId', p_workout_day_exercise_id
    ))
  );

  select day.id, slot.id into cloned_day_id, cloned_slot_id
  from public.workout_days day
  join public.workout_day_exercises slot on slot.workout_day_id = day.id
  where day.workout_plan_id = cloned_plan_id
    and day.position = source_context.day_position
    and slot.position = source_context.slot_position;

  update public.workout_day_exercises
  set exercise_id = p_replacement_exercise_id, updated_at = now()
  where id = cloned_slot_id;

  quality := private.assert_plan_quality_v212(cloned_plan_id);
  update public.workout_plans
  set quality_metrics = quality, updated_at = now()
  where id = cloned_plan_id;

  update public.workout_plans
  set status = 'archived', archived_at = now(), updated_at = now()
  where id = source_context.plan_id and status = 'active';
  if not found then raise exception 'O plano ativo mudou; tente novamente'; end if;

  update public.workout_plans
  set status = 'active', activated_at = now(), archived_at = null, updated_at = now()
  where id = cloned_plan_id and status = 'draft';
  if not found then raise exception 'Não foi possível ativar a nova versão'; end if;

  insert into public.plan_exercise_change_events(
    user_id, source_plan_id, resulting_plan_id, source_slot_id,
    resulting_slot_id, from_exercise_id, to_exercise_id, change_type,
    changes, persistent_exclusion, preference_had_row, preference_previous_value
  ) values (
    current_user_id, source_context.plan_id, cloned_plan_id,
    p_workout_day_exercise_id, cloned_slot_id, source_context.source_exercise_id,
    p_replacement_exercise_id, 'equivalent',
    jsonb_build_array(jsonb_build_object(
      'before', source_context.source_name,
      'after', replacement_name,
      'dayPosition', source_context.day_position,
      'slotPosition', source_context.slot_position
    )), p_persist_exclusion, preference_had_row,
    previous_preference.preference
  ) returning id into event_id;

  return jsonb_build_object(
    'eventId', event_id,
    'planId', cloned_plan_id,
    'dayId', cloned_day_id,
    'exerciseId', p_replacement_exercise_id,
    'exerciseName', replacement_name,
    'quality', quality
  );
end;
$$;

revoke all on function private.replace_plan_exercise_v212_internal(uuid,uuid,boolean)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function private.replace_plan_exercise_v212_internal(uuid,uuid,boolean)
  to authenticated;

create or replace function public.replace_plan_exercise_v212(
  p_workout_day_exercise_id uuid,
  p_replacement_exercise_id uuid,
  p_persist_exclusion boolean default false
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.replace_plan_exercise_v212_internal($1, $2, $3);
$$;

revoke all on function public.replace_plan_exercise_v212(uuid,uuid,boolean)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.replace_plan_exercise_v212(uuid,uuid,boolean)
  to authenticated;

create or replace function private.preview_plan_rebalance_v212_internal(
  p_workout_day_exercise_id uuid,
  p_desired_exercise_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  source_context record;
  target_context record;
  source_replacement record;
  desired_name text;
  cloned_plan_id uuid;
  cloned_source_slot_id uuid;
  cloned_target_slot_id uuid;
  cloned_day_id uuid;
  quality jsonb;
  changes jsonb;
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  if p_desired_exercise_id is null then raise exception 'Exercício desejado inválido'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 212)
  );

  select plan.id plan_id, day.id day_id, day.name day_name,
    day.position day_position, slot.position slot_position,
    slot.exercise_id source_exercise_id, source.name_pt source_name
  into source_context
  from public.workout_day_exercises slot
  join public.workout_days day on day.id = slot.workout_day_id
  join public.workout_plans plan on plan.id = day.workout_plan_id
  join public.exercises source on source.id = slot.exercise_id
  where slot.id = p_workout_day_exercise_id
    and plan.user_id = current_user_id and plan.status = 'active'
  for update of plan;
  if not found then raise exception 'Slot de plano ativo não encontrado'; end if;

  if private.exercises_are_semantically_equivalent_v212(
    source_context.source_exercise_id, p_desired_exercise_id
  ) then raise exception 'Este exercício pode ser usado como troca equivalente'; end if;
  if not private.exercise_media_is_ready(p_desired_exercise_id)
     or not private.exercise_auto_plan_eligible(p_desired_exercise_id, current_user_id)
     or not exists (
       select 1 from public.exercises exercise
       where exercise.id = p_desired_exercise_id and exercise.active
     ) then raise exception 'Exercício desejado indisponível para este plano'; end if;
  if exists (
    select 1 from public.workout_days day
    join public.workout_day_exercises slot on slot.workout_day_id = day.id
    where day.workout_plan_id = source_context.plan_id
      and slot.exercise_id = p_desired_exercise_id
  ) then raise exception 'Este exercício já faz parte do plano'; end if;

  select exercise.name_pt into desired_name
  from public.exercises exercise where exercise.id = p_desired_exercise_id;

  select slot.id slot_id, day.id day_id, day.name day_name,
    day.position day_position, slot.position slot_position,
    slot.exercise_id exercise_id, exercise.name_pt exercise_name
  into target_context
  from public.workout_days day
  join public.workout_day_exercises slot on slot.workout_day_id = day.id
  join public.exercises exercise on exercise.id = slot.exercise_id
  where day.workout_plan_id = source_context.plan_id
    and slot.id <> p_workout_day_exercise_id
    and private.exercises_are_semantically_equivalent_v212(
      slot.exercise_id, p_desired_exercise_id
    )
  order by (day.id = source_context.day_id) desc, day.position, slot.position
  limit 1;
  if not found then
    raise exception 'Não há uma posição segura para incluir esse exercício sem perder o equilíbrio';
  end if;

  select candidate.id exercise_id, candidate.name_pt exercise_name
  into source_replacement
  from public.exercises candidate
  left join public.exercise_substitutions explicit
    on explicit.exercise_id = source_context.source_exercise_id
    and explicit.alternative_exercise_id = candidate.id
  where candidate.active
    and candidate.id <> p_desired_exercise_id
    and private.exercises_are_semantically_equivalent_v212(
      source_context.source_exercise_id, candidate.id
    )
    and private.exercise_media_is_ready(candidate.id)
    and private.exercise_auto_plan_eligible(candidate.id, current_user_id)
    and not exists (
      select 1 from public.workout_days day
      join public.workout_day_exercises slot on slot.workout_day_id = day.id
      where day.workout_plan_id = source_context.plan_id
        and slot.exercise_id = candidate.id
    )
  order by coalesce(explicit.score, 0) desc,
    (candidate.difficulty = (
      select difficulty from public.exercises
      where id = source_context.source_exercise_id
    )) desc,
    candidate.name_pt, candidate.id
  limit 1;
  if not found then
    raise exception 'Não há alternativa segura para a função removida';
  end if;

  delete from public.workout_plans plan
  where plan.user_id = current_user_id and plan.status = 'draft'
    and plan.generator_version = 'v2.1.2'
    and plan.generation_rationale ? 'v212Rebalance';

  changes := jsonb_build_array(
    jsonb_build_object(
      'kind', 'replacement', 'day', source_context.day_name,
      'before', source_context.source_name,
      'after', source_replacement.exercise_name
    ),
    jsonb_build_object(
      'kind', 'additional_adjustment', 'day', target_context.day_name,
      'before', target_context.exercise_name, 'after', desired_name
    )
  );

  cloned_plan_id := private.clone_plan_v212(
    source_context.plan_id,
    current_user_id,
    jsonb_build_object('v212Rebalance', jsonb_build_object(
      'sourcePlanId', source_context.plan_id,
      'sourceSlotId', p_workout_day_exercise_id,
      'sourceDayPosition', source_context.day_position,
      'sourceSlotPosition', source_context.slot_position,
      'targetSlotId', target_context.slot_id,
      'targetDayPosition', target_context.day_position,
      'targetSlotPosition', target_context.slot_position,
      'fromExerciseId', source_context.source_exercise_id,
      'desiredExerciseId', p_desired_exercise_id,
      'changes', changes
    ))
  );

  select slot.id, day.id into cloned_source_slot_id, cloned_day_id
  from public.workout_days day
  join public.workout_day_exercises slot on slot.workout_day_id = day.id
  where day.workout_plan_id = cloned_plan_id
    and day.position = source_context.day_position
    and slot.position = source_context.slot_position;
  select slot.id into cloned_target_slot_id
  from public.workout_days day
  join public.workout_day_exercises slot on slot.workout_day_id = day.id
  where day.workout_plan_id = cloned_plan_id
    and day.position = target_context.day_position
    and slot.position = target_context.slot_position;

  update public.workout_day_exercises
  set exercise_id = source_replacement.exercise_id, updated_at = now()
  where id = cloned_source_slot_id;
  update public.workout_day_exercises
  set exercise_id = p_desired_exercise_id, updated_at = now()
  where id = cloned_target_slot_id;

  quality := private.assert_plan_quality_v212(cloned_plan_id);
  update public.workout_plans
  set quality_metrics = quality,
    generation_rationale = generation_rationale || jsonb_build_object(
      'v212ResultSlots', jsonb_build_object(
        'sourceSlotId', cloned_source_slot_id,
        'targetSlotId', cloned_target_slot_id,
        'dayId', cloned_day_id
      )
    ),
    updated_at = now()
  where id = cloned_plan_id;

  return jsonb_build_object(
    'planId', cloned_plan_id,
    'sourcePlanId', source_context.plan_id,
    'dayId', cloned_day_id,
    'changes', changes,
    'quality', quality
  );
end;
$$;

revoke all on function private.preview_plan_rebalance_v212_internal(uuid,uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function private.preview_plan_rebalance_v212_internal(uuid,uuid)
  to authenticated;

create or replace function public.preview_plan_rebalance_v212(
  p_workout_day_exercise_id uuid,
  p_desired_exercise_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.preview_plan_rebalance_v212_internal($1, $2);
$$;

revoke all on function public.preview_plan_rebalance_v212(uuid,uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.preview_plan_rebalance_v212(uuid,uuid)
  to authenticated;

create or replace function private.activate_plan_rebalance_v212_internal(
  p_plan_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  preview_plan public.workout_plans%rowtype;
  metadata jsonb;
  result_slots jsonb;
  event_id uuid;
  quality jsonb;
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 212)
  );

  select * into preview_plan from public.workout_plans plan
  where plan.id = p_plan_id and plan.user_id = current_user_id
    and plan.status = 'draft' and plan.generator_version = 'v2.1.2'
  for update;
  if not found then raise exception 'Prévia não encontrada'; end if;

  metadata := preview_plan.generation_rationale->'v212Rebalance';
  result_slots := preview_plan.generation_rationale->'v212ResultSlots';
  if metadata is null or result_slots is null then raise exception 'Prévia inválida'; end if;
  if not exists (
    select 1 from public.workout_plans source
    where source.id = (metadata->>'sourcePlanId')::uuid
      and source.user_id = current_user_id and source.status = 'active'
  ) then raise exception 'O plano ativo mudou; gere uma nova prévia'; end if;

  quality := private.assert_plan_quality_v212(p_plan_id);
  update public.workout_plans
  set status = 'archived', archived_at = now(), updated_at = now()
  where id = (metadata->>'sourcePlanId')::uuid and status = 'active';
  if not found then raise exception 'O plano ativo mudou; tente novamente'; end if;
  update public.workout_plans
  set status = 'active', activated_at = now(), archived_at = null,
    quality_metrics = quality, updated_at = now()
  where id = p_plan_id and status = 'draft';
  if not found then raise exception 'Não foi possível ativar a reorganização'; end if;

  insert into public.plan_exercise_change_events(
    user_id, source_plan_id, resulting_plan_id, source_slot_id,
    resulting_slot_id, from_exercise_id, to_exercise_id, change_type, changes
  ) values (
    current_user_id, (metadata->>'sourcePlanId')::uuid, p_plan_id,
    (metadata->>'sourceSlotId')::uuid,
    (result_slots->>'sourceSlotId')::uuid,
    (metadata->>'fromExerciseId')::uuid,
    (metadata->>'desiredExerciseId')::uuid,
    'rebalance', metadata->'changes'
  ) returning id into event_id;

  return jsonb_build_object(
    'eventId', event_id,
    'planId', p_plan_id,
    'dayId', result_slots->>'dayId',
    'quality', quality
  );
end;
$$;

revoke all on function private.activate_plan_rebalance_v212_internal(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function private.activate_plan_rebalance_v212_internal(uuid)
  to authenticated;

create or replace function public.activate_plan_rebalance_v212(p_plan_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.activate_plan_rebalance_v212_internal($1);
$$;

revoke all on function public.activate_plan_rebalance_v212(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.activate_plan_rebalance_v212(uuid)
  to authenticated;

create or replace function private.undo_plan_exercise_change_v212_internal(
  p_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  change_event public.plan_exercise_change_events%rowtype;
  source_day_id uuid;
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 212)
  );

  select * into change_event
  from public.plan_exercise_change_events event
  where event.id = p_event_id and event.user_id = current_user_id
    and event.undone_at is null
  for update;
  if not found then raise exception 'Alteração não encontrada ou já desfeita'; end if;
  if not exists (
    select 1 from public.workout_plans plan
    where plan.id = change_event.resulting_plan_id
      and plan.user_id = current_user_id and plan.status = 'active'
  ) then raise exception 'Desfaça primeiro a alteração mais recente do plano'; end if;

  if change_event.persistent_exclusion then
    if change_event.preference_had_row then
      insert into public.user_exercise_preferences(user_id, exercise_id, preference)
      values(current_user_id, change_event.from_exercise_id,
        change_event.preference_previous_value)
      on conflict(user_id, exercise_id) do update set
        preference = excluded.preference, updated_at = now();
    else
      delete from public.user_exercise_preferences
      where user_id = current_user_id
        and exercise_id = change_event.from_exercise_id;
    end if;
  end if;

  update public.workout_plans
  set status = 'archived', archived_at = now(), updated_at = now()
  where id = change_event.resulting_plan_id and status = 'active';
  update public.workout_plans
  set status = 'active', activated_at = now(), archived_at = null, updated_at = now()
  where id = change_event.source_plan_id and user_id = current_user_id
    and status = 'archived';
  if not found then raise exception 'A versão anterior não está disponível'; end if;

  update public.plan_exercise_change_events
  set undone_at = now() where id = p_event_id;
  select slot.workout_day_id into source_day_id
  from public.workout_day_exercises slot
  where slot.id = change_event.source_slot_id;

  return jsonb_build_object(
    'planId', change_event.source_plan_id,
    'dayId', source_day_id,
    'exerciseId', change_event.from_exercise_id
  );
end;
$$;

revoke all on function private.undo_plan_exercise_change_v212_internal(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function private.undo_plan_exercise_change_v212_internal(uuid)
  to authenticated;

create or replace function public.undo_plan_exercise_change_v212(p_event_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.undo_plan_exercise_change_v212_internal($1);
$$;

revoke all on function public.undo_plan_exercise_change_v212(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.undo_plan_exercise_change_v212(uuid)
  to authenticated;

create or replace function public.enforce_plan_activation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare quality jsonb; goal_alignment jsonb;
begin
  if new.status = 'active'
     and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    quality := private.calculate_plan_quality(new.id);
    if coalesce((quality->>'totalSlots')::integer, 0) = 0
       or coalesce((quality->>'mediaCoveragePercent')::numeric, 0) <> 100
       or jsonb_array_length(quality->'ineligibleExercises') <> 0 then
      raise exception 'Plano bloqueado: mídia ou elegibilidade incompleta';
    end if;
    if new.generator_version like 'v2.1%'
       and new.sessions_per_week = 3
       and new.target_session_minutes = 60
       and (
         coalesce((quality->>'totalSlots')::integer, 0) <> 18
         or coalesce((quality->>'uniqueExercises')::integer, 0) < 12
         or coalesce((quality->>'maxExactExerciseFrequency')::integer, 0) > 2
         or jsonb_array_length(quality->'exactExerciseOnAllDays') <> 0
         or coalesce((quality->>'maxDayPairOverlapPercent')::numeric, 100) > 50
         or coalesce((quality->>'movementPatternCount')::integer, 0) < 8
         or jsonb_array_length(quality->'invalidEquipment') <> 0
       ) then
      raise exception 'Plano v2.1 bloqueado: gates de diversidade não atendidos';
    end if;
    if new.generator_version in ('v2.1.1', 'v2.1.2') then
      goal_alignment := private.calculate_goal_alignment_v211(new.id);
      if goal_alignment->>'status' <> 'PASS' then
        raise exception 'Plano v2.1 bloqueado: objetivo não refletido na programação';
      end if;
      quality := quality || jsonb_build_object('goalAlignment', goal_alignment);
    end if;
    new.quality_metrics := quality;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_plan_activation()
  from public, anon, authenticated, service_role, supabase_auth_admin;

create or replace function public.prevent_active_plan_structure_mutation_v212()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owning_plan_status text;
begin
  if tg_table_name = 'workout_days' then
    select plan.status into owning_plan_status
    from public.workout_plans plan
    where plan.id = coalesce(new.workout_plan_id, old.workout_plan_id);
  else
    select plan.status into owning_plan_status
    from public.workout_days day
    join public.workout_plans plan on plan.id = day.workout_plan_id
    where day.id = coalesce(new.workout_day_id, old.workout_day_id);
  end if;

  if owning_plan_status = 'active' then
    raise exception 'A estrutura do plano ativo exige uma nova versão';
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function public.prevent_active_plan_structure_mutation_v212()
  from public, anon, authenticated, service_role, supabase_auth_admin;

drop trigger if exists prevent_active_workout_day_mutation_v212
  on public.workout_days;
create trigger prevent_active_workout_day_mutation_v212
before insert or update or delete on public.workout_days
for each row execute function public.prevent_active_plan_structure_mutation_v212();

drop trigger if exists prevent_active_workout_slot_mutation_v212
  on public.workout_day_exercises;
create trigger prevent_active_workout_slot_mutation_v212
before insert or update or delete on public.workout_day_exercises
for each row execute function public.prevent_active_plan_structure_mutation_v212();

comment on column public.exercises.training_role is
  'Programming role used with movement pattern to determine strict semantic equivalence.';
comment on table public.plan_exercise_change_events is
  'Ownership-scoped audit and undo chain for versioned plan-level exercise changes.';
comment on function public.prevent_active_plan_structure_mutation_v212() is
  'Blocks direct structural mutation of active plans; versioned RPCs edit draft clones.';
comment on function public.get_plan_replacement_candidates_v212(uuid,text,integer,integer) is
  'Ranks eligible media-ready replacements without exposing internal scores.';
comment on function public.replace_plan_exercise_v212(uuid,uuid,boolean) is
  'Creates and atomically activates a validated plan version for a strict equivalent swap.';
comment on function public.preview_plan_rebalance_v212(uuid,uuid) is
  'Creates a validated draft preview for an explicitly requested non-equivalent exercise.';
comment on function public.activate_plan_rebalance_v212(uuid) is
  'Atomically activates an owned validated v2.1.2 rebalance preview.';
comment on function public.undo_plan_exercise_change_v212(uuid) is
  'Restores the immediately previous plan version and any persisted exclusion state.';

commit;
