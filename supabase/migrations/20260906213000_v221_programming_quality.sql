-- VM Training v2.2.1: programming-needs quality gates and variable slot count.
-- Additive only: existing plans, sessions, history and catalog rows are preserved.

create or replace function private.calculate_goal_alignment_v221(p_plan_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  selected_goal text;
  day_count integer;
  total_slots integer;
  strength_slots integer;
  cardio_slots integer;
  mobility_or_posture_slots integer;
  posture_relevant_slots integer;
  lower_rep_strength_slots integer;
  moderate_rep_strength_slots integer;
  long_rest_strength_slots integer;
  reasons text[] := '{}'::text[];
begin
  select plan.goal_code into selected_goal
  from public.workout_plans plan
  where plan.id = p_plan_id;
  if not found then raise exception 'Plano nao encontrado'; end if;

  select count(distinct day.id)::integer,
    count(item.id)::integer,
    count(item.id) filter (where exercise.category = 'strength')::integer,
    count(item.id) filter (where exercise.category = 'cardio')::integer,
    count(item.id) filter (
      where exercise.category = 'mobility' or exercise.movement_pattern = 'posture'
    )::integer,
    count(item.id) filter (where exercise.movement_pattern in (
      'horizontal_pull', 'vertical_pull', 'posture', 'hinge', 'hip_extension',
      'knee_flexion', 'core_anti_rotation', 'core_anti_extension', 'carry'
    ))::integer,
    count(item.id) filter (
      where exercise.category = 'strength' and item.rep_max > 0 and item.rep_max <= 8
    )::integer,
    count(item.id) filter (
      where exercise.category = 'strength' and item.rep_min >= 8 and item.rep_max <= 15
    )::integer,
    count(item.id) filter (
      where exercise.category = 'strength' and item.rest_seconds >= 105
    )::integer
  into day_count, total_slots, strength_slots, cardio_slots,
    mobility_or_posture_slots, posture_relevant_slots,
    lower_rep_strength_slots, moderate_rep_strength_slots,
    long_rest_strength_slots
  from public.workout_days day
  left join public.workout_day_exercises item on item.workout_day_id = day.id
  left join public.exercises exercise on exercise.id = item.exercise_id
  where day.workout_plan_id = p_plan_id;

  if selected_goal = 'strength' then
    if strength_slots < total_slots * 0.75 then reasons := array_append(reasons, 'strength_volume'); end if;
    if lower_rep_strength_slots < strength_slots * 0.5 then reasons := array_append(reasons, 'strength_reps'); end if;
    if long_rest_strength_slots < strength_slots * 0.5 then reasons := array_append(reasons, 'strength_rest'); end if;
  elsif selected_goal = 'muscle_gain' then
    if strength_slots < total_slots * 0.75 then reasons := array_append(reasons, 'hypertrophy_volume'); end if;
    if moderate_rep_strength_slots < strength_slots * 0.7 then reasons := array_append(reasons, 'hypertrophy_reps'); end if;
  elsif selected_goal in ('conditioning', 'cardio_endurance', 'fat_loss', 'weight_loss', 'measurements') then
    if cardio_slots < day_count then reasons := array_append(reasons, 'conditioning_cardio'); end if;
    if strength_slots < day_count * 2 then reasons := array_append(reasons, 'conditioning_strength_foundation'); end if;
  elsif selected_goal = 'mobility' then
    if mobility_or_posture_slots < day_count then reasons := array_append(reasons, 'movement_quality_volume'); end if;
    if strength_slots < day_count * 3 then reasons := array_append(reasons, 'movement_quality_strength_foundation'); end if;
  elsif selected_goal = 'posture' then
    if posture_relevant_slots < day_count * 2 then reasons := array_append(reasons, 'posture_functional_coverage'); end if;
    if strength_slots < day_count * 3 then reasons := array_append(reasons, 'movement_quality_strength_foundation'); end if;
  else
    if strength_slots < day_count * 3 then reasons := array_append(reasons, 'health_strength_foundation'); end if;
    if day_count >= 3 and mobility_or_posture_slots < 1 then reasons := array_append(reasons, 'health_movement_quality'); end if;
    if day_count >= 3 and cardio_slots < 1 then reasons := array_append(reasons, 'health_conditioning'); end if;
  end if;

  return jsonb_build_object(
    'status', case when cardinality(reasons) = 0 then 'PASS' else 'FAIL' end,
    'goal', selected_goal,
    'strengthSlots', strength_slots,
    'cardioSlots', cardio_slots,
    'mobilityOrPostureSlots', mobility_or_posture_slots,
    'lowerRepStrengthSlots', lower_rep_strength_slots,
    'moderateRepStrengthSlots', moderate_rep_strength_slots,
    'longRestStrengthSlots', long_rest_strength_slots,
    'reasons', to_jsonb(reasons)
  );
end;
$$;
revoke all on function private.calculate_goal_alignment_v221(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;

create or replace function private.assert_plan_quality_v221(p_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_plan public.workout_plans%rowtype;
  retained_avoid uuid;
  base_quality jsonb;
  engine_quality jsonb;
  goal_alignment jsonb;
  gym_quality jsonb;
  selected_slots jsonb;
  pruned_slots jsonb;
  total_slots integer;
begin
  select * into selected_plan
  from public.workout_plans plan
  where plan.id = p_plan_id and plan.generator_version = 'v2.2.1';
  if not found then raise exception 'Preview de plano v2.2.1 nao encontrado'; end if;

  retained_avoid := nullif(
    selected_plan.generation_rationale #>> '{v213RetainedAvoid,exerciseId}', ''
  )::uuid;
  base_quality := private.calculate_plan_quality_v213(p_plan_id, retained_avoid);
  engine_quality := coalesce(selected_plan.generation_rationale->'quality', '{}'::jsonb);
  goal_alignment := private.calculate_goal_alignment_v221(p_plan_id);
  gym_quality := private.calculate_gym_first_quality_v215(p_plan_id);
  selected_slots := selected_plan.generation_rationale->'selectedSlots';
  pruned_slots := selected_plan.generation_rationale->'prunedSlots';
  total_slots := coalesce((base_quality->>'totalSlots')::integer, 0);

  if total_slots = 0
     or coalesce((base_quality->>'mediaCoveragePercent')::numeric, 0) <> 100
     or jsonb_array_length(base_quality->'ineligibleExercises') <> 0
     or jsonb_array_length(base_quality->'invalidEquipment') <> 0 then
    raise exception 'PLAN_SAFETY_CONSTRAINT: media, equipamento ou elegibilidade invalida';
  end if;
  if goal_alignment->>'status' <> 'PASS' then
    raise exception 'GOAL_ALIGNMENT_CONSTRAINT: alinhamento funcional v2.2.1 invalido';
  end if;
  if gym_quality->>'status' <> 'PASS' then
    raise exception 'GYM_FIRST_CONSTRAINT: composicao comercial invalida';
  end if;

  if selected_plan.sessions_per_week = 3
     and selected_plan.target_session_minutes = 60
     and (
       total_slots not between 15 and 18
       or coalesce((base_quality->>'uniqueExercises')::integer, 0) < 12
       or coalesce((base_quality->>'maxExactExerciseFrequency')::integer, 0) > 2
       or jsonb_array_length(base_quality->'exactExerciseOnAllDays') <> 0
       or coalesce((base_quality->>'maxDayPairOverlapPercent')::numeric, 100) > 50
     ) then
    raise exception 'PLAN_DIVERSITY_CONSTRAINT: diversidade v2.2.1 invalida';
  end if;

  if jsonb_typeof(selected_slots) is distinct from 'array'
     or jsonb_typeof(pruned_slots) is distinct from 'array'
     or jsonb_array_length(selected_slots) <> total_slots then
    raise exception 'SLOT_AUDIT_CONSTRAINT: trilha de slots v2.2.1 incompleta';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(selected_slots) slot
    where slot->>'need' is null
      or slot->>'needStatus' is null
      or slot->>'requirement' is null
      or slot->>'requirement' not in ('REQUIRED', 'OPTIONAL')
      or slot->>'programmingValue' is null
      or slot->>'minimumProgrammingValue' is null
      or slot->>'estimatedTimeMinutes' is null
      or slot->>'justification' is null
      or btrim(slot->>'justification') = ''
      or (
        slot->>'requirement' = 'OPTIONAL'
        and (slot->>'programmingValue')::numeric < (slot->>'minimumProgrammingValue')::numeric
      )
  ) then
    raise exception 'SLOT_JUSTIFICATION_CONSTRAINT: slot selecionado sem justificativa valida';
  end if;

  if engine_quality #>> '{goalAlignment,status}' <> 'PASS'
     or engine_quality->>'weeklyBalanceStatus' <> 'PASS'
     or engine_quality->>'orderingStatus' <> 'PASS'
     or engine_quality->>'functionalCoverageStatus' <> 'PASS'
     or engine_quality->>'slotJustificationStatus' <> 'PASS'
     or engine_quality->>'sessionEfficiencyStatus' <> 'PASS'
     or engine_quality->>'environmentContextFitStatus' <> 'PASS'
     or engine_quality->>'programQualityStatus' <> 'PASS'
     or coalesce((engine_quality->>'fillerSlots')::integer, -1) <> 0
     or coalesce((engine_quality->>'unjustifiedCorrectiveSlots')::integer, -1) <> 0 then
    raise exception 'PROGRAM_QUALITY_CONSTRAINT: gates v2.2.1 nao foram atingidos';
  end if;

  if exists (
    select 1
    from public.workout_days day
    join public.workout_day_exercises item on item.workout_day_id = day.id
    where day.workout_plan_id = p_plan_id
      and (
        item.slot_role is null
        or item.selection_rationale is null
        or btrim(item.selection_rationale) = ''
        or item.exercise_family is null
      )
  ) then
    raise exception 'PROGRAM_METADATA_CONSTRAINT: slot sem metadados v2.2.1';
  end if;

  return engine_quality
    || base_quality
    || jsonb_build_object('goalAlignment', goal_alignment)
    || (gym_quality - 'status');
end;
$$;
revoke all on function private.assert_plan_quality_v221(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;

create or replace function private.create_plan_preview_v221(
  p_user_id uuid,
  p_days jsonb,
  p_generator_version text,
  p_rationale jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  preference public.training_preferences%rowtype;
  selected_goal text;
  plan_id uuid;
  day_id uuid;
  day_entry record;
  exercise_entry record;
  quality jsonb;
begin
  if p_user_id is null then raise exception 'Usuario invalido'; end if;
  if p_generator_version <> 'v2.2.1' then raise exception 'Versao do gerador invalida'; end if;
  if jsonb_typeof(p_days) <> 'array' then raise exception 'Plano invalido'; end if;

  select * into strict preference
  from public.training_preferences
  where user_id = p_user_id;
  select goal.goal_code into selected_goal
  from public.user_goals goal
  where goal.user_id = p_user_id and goal.active
  order by goal.priority, goal.goal_code
  limit 1;
  if selected_goal is null then raise exception 'Objetivo principal nao encontrado'; end if;
  if jsonb_array_length(p_days) <> preference.sessions_per_week then
    raise exception 'Quantidade de dias diverge das preferencias';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 221)
  );
  update public.workout_plans
  set status = 'archived', archived_at = now()
  where user_id = p_user_id
    and status = 'draft'
    and generator_version = 'v2.2.1';

  insert into public.workout_plans(
    user_id, name, status, source, sessions_per_week, target_session_minutes,
    generator_version, generation_rationale, goal_code
  ) values (
    p_user_id, 'Meu plano', 'draft', 'generated', preference.sessions_per_week,
    preference.session_minutes, p_generator_version,
    coalesce(p_rationale, '{}'::jsonb), selected_goal
  ) returning id into plan_id;

  for day_entry in
    select day.value, day.ordinality
    from jsonb_array_elements(p_days) with ordinality day(value, ordinality)
    order by day.ordinality
  loop
    if jsonb_typeof(day_entry.value->'exercises') <> 'array'
       or jsonb_array_length(day_entry.value->'exercises') = 0 then
      raise exception 'Dia sem exercicios';
    end if;
    insert into public.workout_days(
      workout_plan_id, name, position, estimated_minutes,
      programming_focus, programming_rationale
    ) values (
      plan_id, day_entry.value->>'name', day_entry.ordinality,
      (day_entry.value->>'estimatedMinutes')::smallint,
      day_entry.value->>'focus', day_entry.value->>'rationale'
    ) returning id into day_id;

    for exercise_entry in
      select exercise.value, exercise.ordinality
      from jsonb_array_elements(day_entry.value->'exercises')
        with ordinality exercise(value, ordinality)
      order by exercise.ordinality
    loop
      if not private.exercise_auto_plan_eligible(
        (exercise_entry.value->>'exerciseId')::uuid,
        p_user_id
      ) then raise exception 'Plano contem exercicio inelegivel'; end if;
      insert into public.workout_day_exercises(
        workout_day_id, exercise_id, position, target_sets,
        rep_min, rep_max, rest_seconds, target_duration_seconds,
        slot_role, exercise_family, selection_rationale,
        progression_recommendation
      ) values (
        day_id,
        (exercise_entry.value->>'exerciseId')::uuid,
        exercise_entry.ordinality,
        (exercise_entry.value->>'sets')::smallint,
        nullif(exercise_entry.value->>'repMin', '0')::smallint,
        nullif(exercise_entry.value->>'repMax', '0')::smallint,
        (exercise_entry.value->>'restSeconds')::integer,
        (exercise_entry.value->>'targetDurationSeconds')::integer,
        exercise_entry.value->>'slotRole',
        exercise_entry.value->>'exerciseFamily',
        exercise_entry.value->>'rationale',
        coalesce(exercise_entry.value->'progression', '{}'::jsonb)
      );
    end loop;
  end loop;

  quality := private.assert_plan_quality_v221(plan_id);
  update public.workout_plans
  set quality_metrics = quality
  where id = plan_id;
  return jsonb_build_object(
    'planId', plan_id,
    'quality', quality,
    'goal', selected_goal
  );
end;
$$;
revoke all on function private.create_plan_preview_v221(uuid,jsonb,text,jsonb)
  from public, anon, authenticated, service_role, supabase_auth_admin;

create or replace function public.create_plan_preview_v221(
  p_days jsonb,
  p_generator_version text,
  p_rationale jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Nao autenticado'; end if;
  return private.create_plan_preview_v221(
    auth.uid(), p_days, p_generator_version, p_rationale
  );
end;
$$;
revoke all on function public.create_plan_preview_v221(jsonb,text,jsonb)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.create_plan_preview_v221(jsonb,text,jsonb)
  to authenticated;

create or replace function public.activate_plan_v221(p_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  quality jsonb;
begin
  if current_user_id is null then raise exception 'Nao autenticado'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 221)
  );
  if not exists (
    select 1
    from public.workout_plans plan
    where plan.id = p_plan_id
      and plan.user_id = current_user_id
      and plan.status = 'draft'
      and plan.generator_version = 'v2.2.1'
  ) then raise exception 'Preview de plano v2.2.1 nao encontrado'; end if;

  quality := private.assert_plan_quality_v221(p_plan_id);
  update public.workout_plans
  set status = 'archived', archived_at = now()
  where user_id = current_user_id
    and status = 'active'
    and id <> p_plan_id;
  update public.workout_plans
  set status = 'active', activated_at = now(), archived_at = null,
    quality_metrics = quality
  where id = p_plan_id
    and user_id = current_user_id
    and status = 'draft';
  if not found then raise exception 'Falha ao ativar o novo plano'; end if;
  return jsonb_build_object('planId', p_plan_id, 'quality', quality);
end;
$$;
revoke all on function public.activate_plan_v221(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.activate_plan_v221(uuid) to authenticated;

create or replace function private.enforce_v220_plan_activation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' and old.status is distinct from 'active' then
    if new.generator_version = 'v2.2.1' then
      new.quality_metrics := private.assert_plan_quality_v221(new.id);
    elsif new.generator_version = 'v2.2.0' then
      new.quality_metrics := private.assert_plan_quality_v220(new.id);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_v220_plan_activation()
  from public, anon, authenticated, service_role, supabase_auth_admin;

comment on function public.create_plan_preview_v221(jsonb,text,jsonb) is
  'Creates an owner-scoped v2.2.1 draft with audited required/optional programming slots.';
comment on function public.activate_plan_v221(uuid) is
  'Explicit owner-only activation after independent v2.2.1 safety and quality validation.';
