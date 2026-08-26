-- VM Training v2.1.3: persistent exclusion affects future generation without
-- forcing every occurrence out of the plan version currently being edited.

begin;

create or replace function private.calculate_plan_quality_v213(
  p_plan_id uuid,
  p_retained_avoid_exercise_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  selected_user_id uuid;
  quality jsonb;
  retained_reasons text[];
  filtered_ineligible jsonb;
begin
  select plan.user_id into selected_user_id
  from public.workout_plans plan
  where plan.id = p_plan_id;
  if not found then raise exception 'Plano não encontrado'; end if;

  quality := private.calculate_plan_quality(p_plan_id);
  if p_retained_avoid_exercise_id is null then return quality; end if;

  retained_reasons := private.exercise_auto_plan_reasons(
    p_retained_avoid_exercise_id,
    selected_user_id
  );
  if not ('user_avoid' = any(retained_reasons))
     or not (retained_reasons <@ array['user_avoid']::text[]) then
    raise exception 'Exercício retido possui outro bloqueio além da preferência futura';
  end if;

  select coalesce(jsonb_agg(entry.value order by entry.ordinality), '[]'::jsonb)
  into filtered_ineligible
  from jsonb_array_elements(quality->'ineligibleExercises')
    with ordinality entry(value, ordinality)
  where entry.value #>> '{}' <> p_retained_avoid_exercise_id::text;

  return jsonb_set(
    quality,
    '{ineligibleExercises}',
    filtered_ineligible,
    true
  ) || jsonb_build_object(
    'retainedCurrentPlanAvoidExerciseId', p_retained_avoid_exercise_id
  );
end;
$$;

revoke all on function private.calculate_plan_quality_v213(uuid,uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;

create or replace function private.assert_plan_quality_v213(
  p_plan_id uuid,
  p_retained_avoid_exercise_id uuid default null
)
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

  quality := private.calculate_plan_quality_v213(
    p_plan_id,
    p_retained_avoid_exercise_id
  );
  goal_alignment := private.calculate_goal_alignment_v211(p_plan_id);
  quality := quality || jsonb_build_object('goalAlignment', goal_alignment);

  if coalesce((quality->>'totalSlots')::integer, 0) = 0
     or coalesce((quality->>'mediaCoveragePercent')::numeric, 0) <> 100
     or jsonb_array_length(quality->'ineligibleExercises') <> 0
     or jsonb_array_length(quality->'invalidEquipment') <> 0 then
    raise exception 'Plano v2.1.3 falhou nos gates de mídia, equipamento ou elegibilidade';
  end if;
  if goal_alignment->>'status' <> 'PASS' then
    raise exception 'Plano v2.1.3 falhou no alinhamento ao objetivo';
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
    raise exception 'Plano v2.1.3 falhou nos gates de diversidade';
  end if;

  return quality;
end;
$$;

revoke all on function private.assert_plan_quality_v213(uuid,uuid)
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
  remaining_occurrence_count integer := 0;
  retained_avoid_exercise_id uuid;
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

  select count(*)::integer into remaining_occurrence_count
  from public.workout_days day
  join public.workout_day_exercises slot on slot.workout_day_id = day.id
  where day.workout_plan_id = cloned_plan_id
    and slot.exercise_id = source_context.source_exercise_id;

  if p_persist_exclusion and remaining_occurrence_count > 0 then
    retained_avoid_exercise_id := source_context.source_exercise_id;
  end if;

  update public.workout_plans
  set generator_version = 'v2.1.3',
    generation_rationale = generation_rationale || jsonb_build_object(
      'v213RetainedAvoid', case
        when retained_avoid_exercise_id is null then null
        else jsonb_build_object(
          'exerciseId', retained_avoid_exercise_id,
          'sourceEventPending', true
        )
      end
    ),
    updated_at = now()
  where id = cloned_plan_id;

  quality := private.assert_plan_quality_v213(
    cloned_plan_id,
    retained_avoid_exercise_id
  );
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

  update public.workout_plans
  set generation_rationale = jsonb_set(
    generation_rationale,
    '{v213RetainedAvoid,sourceEventId}',
    to_jsonb(event_id::text),
    true
  ) #- '{v213RetainedAvoid,sourceEventPending}'
  where id = cloned_plan_id and retained_avoid_exercise_id is not null;

  return jsonb_build_object(
    'eventId', event_id,
    'planId', cloned_plan_id,
    'dayId', cloned_day_id,
    'exerciseId', p_replacement_exercise_id,
    'exerciseName', replacement_name,
    'sourceExerciseId', source_context.source_exercise_id,
    'sourceExerciseName', source_context.source_name,
    'persistentExclusion', p_persist_exclusion,
    'remainingOccurrenceCount', remaining_occurrence_count,
    'quality', quality
  );
end;
$$;

create or replace function private.preview_remaining_exclusions_v213_internal(
  p_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  source_event public.plan_exercise_change_events%rowtype;
  occurrence record;
  candidate record;
  cloned_plan_id uuid;
  cloned_slot_id uuid;
  cloned_day_id uuid;
  first_source_slot_id uuid;
  first_result_slot_id uuid;
  first_candidate_id uuid;
  first_day_id uuid;
  changes jsonb := '[]'::jsonb;
  quality jsonb;
  remaining_count integer := 0;
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 212)
  );

  select * into source_event
  from public.plan_exercise_change_events event
  where event.id = p_event_id
    and event.user_id = current_user_id
    and event.undone_at is null
    and event.persistent_exclusion
    and event.change_type = 'equivalent'
  for update;
  if not found then raise exception 'Alteração persistente não encontrada'; end if;
  if not exists (
    select 1 from public.workout_plans plan
    where plan.id = source_event.resulting_plan_id
      and plan.user_id = current_user_id and plan.status = 'active'
  ) then raise exception 'O plano ativo mudou; gere uma nova prévia'; end if;

  select count(*)::integer into remaining_count
  from public.workout_days day
  join public.workout_day_exercises slot on slot.workout_day_id = day.id
  where day.workout_plan_id = source_event.resulting_plan_id
    and slot.exercise_id = source_event.from_exercise_id;
  if remaining_count = 0 then raise exception 'Não há outras ocorrências para reorganizar'; end if;

  delete from public.workout_plans plan
  where plan.user_id = current_user_id and plan.status = 'draft'
    and plan.generator_version = 'v2.1.3'
    and plan.generation_rationale #>> '{v213ExclusionRebalance,parentEventId}'
      = p_event_id::text;

  cloned_plan_id := private.clone_plan_v212(
    source_event.resulting_plan_id,
    current_user_id,
    jsonb_build_object('v213ExclusionRebalance', jsonb_build_object(
      'parentEventId', p_event_id,
      'sourcePlanId', source_event.resulting_plan_id,
      'fromExerciseId', source_event.from_exercise_id
    ))
  );
  update public.workout_plans set generator_version = 'v2.1.3'
  where id = cloned_plan_id;

  for occurrence in
    select slot.id source_slot_id, day.position day_position,
      day.name day_name, slot.position slot_position, source.name_pt source_name
    from public.workout_days day
    join public.workout_day_exercises slot on slot.workout_day_id = day.id
    join public.exercises source on source.id = slot.exercise_id
    where day.workout_plan_id = source_event.resulting_plan_id
      and slot.exercise_id = source_event.from_exercise_id
    order by day.position, slot.position
  loop
    select replacement.id exercise_id, replacement.name_pt exercise_name
    into candidate
    from public.exercises replacement
    left join public.exercise_substitutions explicit
      on explicit.exercise_id = source_event.from_exercise_id
      and explicit.alternative_exercise_id = replacement.id
    where replacement.active
      and private.exercises_are_semantically_equivalent_v212(
        source_event.from_exercise_id, replacement.id
      )
      and private.exercise_media_is_ready(replacement.id)
      and private.exercise_auto_plan_eligible(replacement.id, current_user_id)
      and not exists (
        select 1 from public.workout_days candidate_day
        join public.workout_day_exercises candidate_slot
          on candidate_slot.workout_day_id = candidate_day.id
        where candidate_day.workout_plan_id = cloned_plan_id
          and candidate_slot.exercise_id = replacement.id
      )
    order by coalesce(explicit.score, 0) desc,
      case when replacement.difficulty = (
        select source.difficulty from public.exercises source
        where source.id = source_event.from_exercise_id
      ) then 0 else 1 end,
      replacement.name_pt, replacement.id
    limit 1;
    if not found then
      raise exception 'Não encontramos alternativa segura para todas as ocorrências';
    end if;

    select slot.id, day.id into cloned_slot_id, cloned_day_id
    from public.workout_days day
    join public.workout_day_exercises slot on slot.workout_day_id = day.id
    where day.workout_plan_id = cloned_plan_id
      and day.position = occurrence.day_position
      and slot.position = occurrence.slot_position;

    update public.workout_day_exercises
    set exercise_id = candidate.exercise_id, updated_at = now()
    where id = cloned_slot_id;

    if first_source_slot_id is null then
      first_source_slot_id := occurrence.source_slot_id;
      first_result_slot_id := cloned_slot_id;
      first_candidate_id := candidate.exercise_id;
      first_day_id := cloned_day_id;
    end if;
    changes := changes || jsonb_build_array(jsonb_build_object(
      'kind', 'replacement',
      'day', occurrence.day_name,
      'before', occurrence.source_name,
      'after', candidate.exercise_name,
      'dayPosition', occurrence.day_position,
      'slotPosition', occurrence.slot_position
    ));
  end loop;

  quality := private.assert_plan_quality_v213(cloned_plan_id, null);
  update public.workout_plans
  set quality_metrics = quality,
    generation_rationale = (generation_rationale #- '{v213RetainedAvoid}')
      || jsonb_build_object(
        'v213ExclusionRebalance', jsonb_build_object(
          'parentEventId', p_event_id,
          'sourcePlanId', source_event.resulting_plan_id,
          'sourceSlotId', first_source_slot_id,
          'resultingSlotId', first_result_slot_id,
          'fromExerciseId', source_event.from_exercise_id,
          'toExerciseId', first_candidate_id,
          'dayId', first_day_id,
          'changes', changes
        )
      ),
    updated_at = now()
  where id = cloned_plan_id;

  return jsonb_build_object(
    'planId', cloned_plan_id,
    'sourcePlanId', source_event.resulting_plan_id,
    'dayId', first_day_id,
    'changes', changes,
    'quality', quality
  );
end;
$$;

revoke all on function private.preview_remaining_exclusions_v213_internal(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function private.preview_remaining_exclusions_v213_internal(uuid)
  to authenticated;

create or replace function public.preview_remaining_exclusions_v213(p_event_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.preview_remaining_exclusions_v213_internal($1);
$$;

revoke all on function public.preview_remaining_exclusions_v213(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.preview_remaining_exclusions_v213(uuid)
  to authenticated;

create or replace function private.activate_remaining_exclusions_v213_internal(
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
  event_id uuid;
  quality jsonb;
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 212)
  );

  select * into preview_plan from public.workout_plans plan
  where plan.id = p_plan_id and plan.user_id = current_user_id
    and plan.status = 'draft' and plan.generator_version = 'v2.1.3'
  for update;
  if not found then raise exception 'Prévia não encontrada'; end if;
  metadata := preview_plan.generation_rationale->'v213ExclusionRebalance';
  if metadata is null then raise exception 'Prévia inválida'; end if;
  if not exists (
    select 1 from public.workout_plans source
    where source.id = (metadata->>'sourcePlanId')::uuid
      and source.user_id = current_user_id and source.status = 'active'
  ) then raise exception 'O plano ativo mudou; gere uma nova prévia'; end if;

  quality := private.assert_plan_quality_v213(p_plan_id, null);
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
    (metadata->>'resultingSlotId')::uuid,
    (metadata->>'fromExerciseId')::uuid,
    (metadata->>'toExerciseId')::uuid,
    'rebalance', metadata->'changes'
  ) returning id into event_id;

  return jsonb_build_object(
    'eventId', event_id,
    'planId', p_plan_id,
    'dayId', metadata->>'dayId',
    'quality', quality
  );
end;
$$;

revoke all on function private.activate_remaining_exclusions_v213_internal(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function private.activate_remaining_exclusions_v213_internal(uuid)
  to authenticated;

create or replace function public.activate_remaining_exclusions_v213(p_plan_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.activate_remaining_exclusions_v213_internal($1);
$$;

revoke all on function public.activate_remaining_exclusions_v213(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.activate_remaining_exclusions_v213(uuid)
  to authenticated;

create or replace function public.enforce_plan_activation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  quality jsonb;
  goal_alignment jsonb;
  retained_avoid_exercise_id uuid;
begin
  if new.status = 'active'
     and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    retained_avoid_exercise_id := nullif(
      new.generation_rationale #>> '{v213RetainedAvoid,exerciseId}',
      ''
    )::uuid;
    quality := private.calculate_plan_quality_v213(
      new.id,
      retained_avoid_exercise_id
    );
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
    if new.generator_version like 'v2.1%' then
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

comment on function public.preview_remaining_exclusions_v213(uuid) is
  'Builds an owned draft preview that replaces remaining current-plan occurrences of a persistently avoided exercise.';
comment on function public.activate_remaining_exclusions_v213(uuid) is
  'Atomically activates a validated v2.1.3 remaining-exclusion preview after explicit confirmation.';

commit;
