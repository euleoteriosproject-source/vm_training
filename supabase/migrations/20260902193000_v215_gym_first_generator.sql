-- VM Training v2.1.5: normalized exercise environment metadata and gym-first
-- plan policy. Existing plans and history are intentionally left unchanged.

begin;

alter table public.exercises
  add column if not exists environment_profile text,
  add column if not exists gym_equipment_tier smallint,
  add column if not exists technical_complexity text,
  add column if not exists goal_suitability text[];

-- Classification is persisted from normalized equipment and explicit exercise
-- semantics. Application code never derives it from display names.
update public.exercises exercise
set environment_profile = case
    when exercise.slug in ('farmer-walk','suitcase-carry') then 'specialized_space'
    when exists (
      select 1 from public.exercise_equipment link
      join public.equipment equipment on equipment.id = link.equipment_id
      where link.exercise_id = exercise.id and link.required
        and equipment.slug in ('treadmill','bike','elliptical')
    ) then 'cardio_machine'
    when exists (
      select 1 from public.exercise_equipment link
      join public.equipment equipment on equipment.id = link.equipment_id
      where link.exercise_id = exercise.id and link.required
        and equipment.slug = 'cable'
    ) then 'commercial_cable'
    when exists (
      select 1 from public.exercise_equipment link
      join public.equipment equipment on equipment.id = link.equipment_id
      where link.exercise_id = exercise.id and link.required
        and equipment.slug in (
          'lat-pulldown','row-machine','chest-press','smith','hack-squat',
          'leg-press','leg-extension','lying-leg-curl','seated-leg-curl',
          'abductor','adductor','back-extension-machine'
        )
    ) then 'commercial_machine'
    when exists (
      select 1 from public.exercise_equipment link
      join public.equipment equipment on equipment.id = link.equipment_id
      where link.exercise_id = exercise.id and link.required
        and equipment.slug in ('dumbbells','barbell','bench')
    ) then 'commercial_free_weight'
    when exists (
      select 1 from public.exercise_equipment link
      join public.equipment equipment on equipment.id = link.equipment_id
      where link.exercise_id = exercise.id and link.required
        and equipment.slug = 'pull-up-bar'
    ) then 'bodyweight_station'
    else 'bodyweight_floor'
  end,
  gym_equipment_tier = case
    when exercise.slug in ('farmer-walk','suitcase-carry') then 4
    when exists (
      select 1 from public.exercise_equipment link
      join public.equipment equipment on equipment.id = link.equipment_id
      where link.exercise_id = exercise.id and link.required
        and equipment.slug in (
          'treadmill','bike','elliptical','cable','lat-pulldown','row-machine',
          'chest-press','smith','hack-squat','leg-press','leg-extension',
          'lying-leg-curl','seated-leg-curl','abductor','adductor',
          'back-extension-machine'
        )
    ) then 1
    when exists (
      select 1 from public.exercise_equipment link
      join public.equipment equipment on equipment.id = link.equipment_id
      where link.exercise_id = exercise.id and link.required
        and equipment.slug in ('dumbbells','barbell','bench')
    ) then 2
    else 3
  end,
  technical_complexity = case
    when exercise.slug in (
      'barbell-back-squat','conventional-deadlift','sumo-deadlift',
      'bent-over-barbell-row','standing-barbell-press'
    ) then 'high'
    when exercise.difficulty = 'advanced'
      or exercise.slug in (
        'barbell-bench-press','incline-barbell-press','hip-thrust','pull-up',
        'hanging-straight-leg-raise','hanging-knee-raise','farmer-walk',
        'suitcase-carry'
      ) then 'moderate'
    else 'low'
  end,
  goal_suitability = case
    when exercise.category = 'cardio' then
      array['weight_loss','fat_loss','measurements','conditioning','cardio_endurance','general_health']
    when exercise.category = 'mobility' or exercise.training_role = 'mobility_posture' then
      array['posture','mobility','general_health']
    when exercise.training_role = 'postural_control' then
      array['posture','general_health','mobility','strength']
    when exercise.category = 'strength' then
      array['muscle_gain','strength','weight_loss','fat_loss','measurements','general_health','conditioning']
    else array['general_health']
  end;

alter table public.exercises
  alter column environment_profile set default 'bodyweight_floor',
  alter column environment_profile set not null,
  alter column gym_equipment_tier set default 3,
  alter column gym_equipment_tier set not null,
  alter column technical_complexity set default 'moderate',
  alter column technical_complexity set not null,
  alter column goal_suitability set default array['general_health']::text[],
  alter column goal_suitability set not null;

alter table public.exercises drop constraint if exists exercises_environment_profile_check;
alter table public.exercises add constraint exercises_environment_profile_check check (
  environment_profile in (
    'commercial_machine','commercial_cable','commercial_free_weight',
    'bodyweight_floor','bodyweight_station','cardio_machine','specialized_space'
  )
);
alter table public.exercises drop constraint if exists exercises_gym_equipment_tier_check;
alter table public.exercises add constraint exercises_gym_equipment_tier_check
  check (gym_equipment_tier between 1 and 4);
alter table public.exercises drop constraint if exists exercises_technical_complexity_check;
alter table public.exercises add constraint exercises_technical_complexity_check
  check (technical_complexity in ('low','moderate','high'));
alter table public.exercises drop constraint if exists exercises_goal_suitability_check;
alter table public.exercises add constraint exercises_goal_suitability_check check (
  cardinality(goal_suitability) > 0 and goal_suitability <@ array[
    'weight_loss','fat_loss','measurements','muscle_gain','strength','posture',
    'mobility','conditioning','cardio_endurance','general_health'
  ]::text[]
);

create or replace function private.refresh_exercise_gym_metadata_v215(
  p_exercise_id uuid
)
returns void
language plpgsql security definer set search_path = '' as $$
declare exercise_row public.exercises%rowtype; equipment_slugs text[];
begin
  select * into exercise_row from public.exercises where id = p_exercise_id;
  if not found then return; end if;
  select coalesce(array_agg(equipment.slug order by equipment.slug), '{}'::text[])
    into equipment_slugs
  from public.exercise_equipment link
  join public.equipment equipment on equipment.id = link.equipment_id
  where link.exercise_id = p_exercise_id and link.required;

  update public.exercises set
    environment_profile = case
      when exercise_row.slug in ('farmer-walk','suitcase-carry') then 'specialized_space'
      when equipment_slugs && array['treadmill','bike','elliptical'] then 'cardio_machine'
      when 'cable' = any(equipment_slugs) then 'commercial_cable'
      when equipment_slugs && array[
        'lat-pulldown','row-machine','chest-press','smith','hack-squat',
        'leg-press','leg-extension','lying-leg-curl','seated-leg-curl',
        'abductor','adductor','back-extension-machine'
      ] then 'commercial_machine'
      when equipment_slugs && array['dumbbells','barbell','bench'] then 'commercial_free_weight'
      when 'pull-up-bar' = any(equipment_slugs) then 'bodyweight_station'
      else 'bodyweight_floor' end,
    gym_equipment_tier = case
      when exercise_row.slug in ('farmer-walk','suitcase-carry') then 4
      when equipment_slugs && array[
        'treadmill','bike','elliptical','cable','lat-pulldown','row-machine',
        'chest-press','smith','hack-squat','leg-press','leg-extension',
        'lying-leg-curl','seated-leg-curl','abductor','adductor',
        'back-extension-machine'
      ] then 1
      when equipment_slugs && array['dumbbells','barbell','bench'] then 2
      else 3 end,
    technical_complexity = case
      when exercise_row.slug in (
        'barbell-back-squat','conventional-deadlift','sumo-deadlift',
        'bent-over-barbell-row','standing-barbell-press'
      ) then 'high'
      when exercise_row.difficulty = 'advanced' or exercise_row.slug in (
        'barbell-bench-press','incline-barbell-press','hip-thrust','pull-up',
        'hanging-straight-leg-raise','hanging-knee-raise','farmer-walk',
        'suitcase-carry'
      ) then 'moderate' else 'low' end,
    goal_suitability = case
      when exercise_row.category = 'cardio' then
        array['weight_loss','fat_loss','measurements','conditioning','cardio_endurance','general_health']
      when exercise_row.category = 'mobility' then array['posture','mobility','general_health']
      when exercise_row.training_role = 'postural_control' then
        array['posture','general_health','mobility','strength']
      when exercise_row.category = 'strength' then
        array['muscle_gain','strength','weight_loss','fat_loss','measurements','general_health','conditioning']
      else array['general_health'] end,
    updated_at = now()
  where id = p_exercise_id;
end;
$$;
revoke all on function private.refresh_exercise_gym_metadata_v215(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;

create or replace function private.refresh_exercise_gym_metadata_trigger_v215()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.refresh_exercise_gym_metadata_v215(
    case when tg_op = 'DELETE' then old.exercise_id else new.exercise_id end
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.refresh_exercise_gym_metadata_trigger_v215()
  from public, anon, authenticated, service_role, supabase_auth_admin;

drop trigger if exists refresh_exercise_equipment_gym_metadata_v215
  on public.exercise_equipment;
create trigger refresh_exercise_equipment_gym_metadata_v215
after insert or update of equipment_id, required or delete
on public.exercise_equipment for each row
execute function private.refresh_exercise_gym_metadata_trigger_v215();

create or replace function private.refresh_exercise_row_gym_metadata_trigger_v215()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.refresh_exercise_gym_metadata_v215(new.id);
  return new;
end;
$$;
revoke all on function private.refresh_exercise_row_gym_metadata_trigger_v215()
  from public, anon, authenticated, service_role, supabase_auth_admin;

drop trigger if exists refresh_exercise_row_gym_metadata_v215 on public.exercises;
create trigger refresh_exercise_row_gym_metadata_v215
after insert or update of slug, category, difficulty, training_role
on public.exercises for each row
execute function private.refresh_exercise_row_gym_metadata_trigger_v215();

do $$
declare selected_exercise record;
begin
  for selected_exercise in select id from public.exercises loop
    perform private.refresh_exercise_gym_metadata_v215(selected_exercise.id);
  end loop;
end;
$$;

alter table public.training_preferences
  add column if not exists workout_style text;
update public.training_preferences
set workout_style = case
  when gym_profile = 'STANDARD_COMMERCIAL_GYM' then 'gym_first'
  else 'mixed'
end
where workout_style is null;
alter table public.training_preferences
  alter column workout_style set default 'gym_first',
  alter column workout_style set not null;
alter table public.training_preferences
  drop constraint if exists training_preferences_workout_style_check;
alter table public.training_preferences
  add constraint training_preferences_workout_style_check
  check (workout_style in ('gym_first','mixed','free_weight'));

create or replace function private.exercise_gym_preference_score_v215(
  p_user_id uuid,
  p_exercise_id uuid,
  p_goal_code text
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when preference.gym_profile <> 'STANDARD_COMMERCIAL_GYM' then 0
    when preference.workout_style = 'free_weight' then
      case exercise.gym_equipment_tier when 2 then 34 when 1 then 8 when 3 then -4 else -10 end
    when preference.workout_style = 'mixed' then
      case exercise.gym_equipment_tier when 1 then 12 when 2 then 10 when 3 then 2 else -4 end
    when p_goal_code = 'muscle_gain' then
      case exercise.gym_equipment_tier when 1 then 42 when 2 then 16 when 3 then -34 else -42 end
      + case exercise.technical_complexity when 'low' then 10 when 'high' then -12 else 0 end
    when p_goal_code = 'strength' then
      case exercise.gym_equipment_tier when 1 then 16 when 2 then 26 when 3 then -8 else -16 end
    when p_goal_code in ('conditioning','cardio_endurance','fat_loss','weight_loss') then
      case when exercise.environment_profile = 'cardio_machine' then 24
        when exercise.gym_equipment_tier = 1 then 12
        when exercise.gym_equipment_tier = 3 then 5 else 0 end
    else case exercise.gym_equipment_tier when 1 then 24 when 2 then 14 when 3 then -8 else -14 end
  end + case when p_goal_code = any(exercise.goal_suitability) then 12 else -12 end
  from public.exercises exercise
  join public.training_preferences preference on preference.user_id = p_user_id
  where exercise.id = p_exercise_id;
$$;
revoke all on function private.exercise_gym_preference_score_v215(uuid,uuid,text)
  from public, anon, authenticated, service_role, supabase_auth_admin;

create or replace function public.get_auto_plan_catalog_v215()
returns table (
  id uuid, name text, pattern text, training_role text, category text,
  difficulty text, active boolean, media_ready boolean,
  auto_plan_eligible boolean, required_equipment text[],
  required_capabilities text[], eligibility_reasons text[],
  environment_profile text, gym_equipment_tier smallint,
  technical_complexity text, goal_suitability text[]
)
language plpgsql stable security definer set search_path = '' as $$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  return query
  select exercise.id, exercise.name_pt, exercise.movement_pattern,
    exercise.training_role, exercise.category, exercise.difficulty,
    exercise.active, private.exercise_media_is_ready(exercise.id),
    private.exercise_auto_plan_eligible(exercise.id, current_user_id),
    coalesce((select array_agg(equipment.slug order by equipment.slug)
      from public.exercise_equipment link
      join public.equipment equipment on equipment.id = link.equipment_id
      where link.exercise_id = exercise.id and link.required), '{}'::text[]),
    coalesce((select array_agg(distinct capability.capability order by capability.capability)
      from public.exercise_equipment link
      join public.equipment_capabilities capability on capability.equipment_id = link.equipment_id
      where link.exercise_id = exercise.id and link.required), '{}'::text[]),
    private.exercise_auto_plan_reasons(exercise.id, current_user_id),
    exercise.environment_profile, exercise.gym_equipment_tier,
    exercise.technical_complexity, exercise.goal_suitability
  from public.exercises exercise
  order by exercise.name_pt, exercise.id;
end;
$$;
revoke all on function public.get_auto_plan_catalog_v215()
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.get_auto_plan_catalog_v215() to authenticated;

create or replace function public.save_training_preferences_v215(
  p_goal_code text,
  p_sessions_per_week smallint,
  p_session_minutes smallint,
  p_cardio_preference smallint,
  p_gym_profile text default 'STANDARD_COMMERCIAL_GYM',
  p_workout_style text default 'gym_first'
)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  if p_workout_style not in ('gym_first','mixed','free_weight') then
    raise exception 'Estilo de treino inválido';
  end if;
  result := public.save_training_preferences_v211(
    p_goal_code, p_sessions_per_week, p_session_minutes,
    p_cardio_preference, p_gym_profile
  );
  update public.training_preferences set workout_style = p_workout_style,
    updated_at = now() where user_id = auth.uid();
  if not found then raise exception 'Preferências não encontradas'; end if;
  return result || jsonb_build_object('workoutStyle', p_workout_style);
end;
$$;
revoke all on function public.save_training_preferences_v215(text,smallint,smallint,smallint,text,text)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.save_training_preferences_v215(text,smallint,smallint,smallint,text,text)
  to authenticated;

create or replace function private.calculate_gym_first_quality_v215(p_plan_id uuid)
returns jsonb
language sql stable security definer set search_path = '' as $$
  with selected_plan as (
    select plan.id, plan.user_id, plan.goal_code, preference.gym_profile,
      preference.workout_style
    from public.workout_plans plan
    join public.training_preferences preference on preference.user_id = plan.user_id
    where plan.id = p_plan_id
  ), slots as (
    select day.name day_name, day.position day_position, exercise.id exercise_id,
      exercise.environment_profile, exercise.gym_equipment_tier,
      exercise.movement_pattern, exercise.training_role
    from public.workout_days day
    join public.workout_day_exercises item on item.workout_day_id = day.id
    join public.exercises exercise on exercise.id = item.exercise_id
    where day.workout_plan_id = p_plan_id
  ), metrics as (
    select count(*)::integer total_slots,
      count(*) filter (where gym_equipment_tier <= 2)::integer gym_slots,
      count(*) filter (where environment_profile in (
        'commercial_machine','commercial_cable','cardio_machine'
      ))::integer machine_slots,
      count(*) filter (where environment_profile = 'commercial_free_weight')::integer free_weight_slots,
      count(*) filter (where environment_profile in (
        'bodyweight_floor','bodyweight_station'
      ))::integer bodyweight_slots,
      count(*) filter (where environment_profile = 'specialized_space')::integer specialized_slots,
      count(*) filter (where movement_pattern like 'core_%'
        or movement_pattern = 'posture' or training_role = 'postural_control')::integer core_posture_slots
    from slots
  ), daily as (
    select day_position, count(*) filter (where environment_profile in (
      'bodyweight_floor','bodyweight_station'
    ))::integer bodyweight_slots
    from slots group by day_position
  ), evaluated as (
    select selected_plan.*, metrics.*,
      case when total_slots = 0 then 0 else round(100.0 * gym_slots / total_slots, 1) end gym_percent,
      case when total_slots = 0 then 0 else round(100.0 * bodyweight_slots / total_slots, 1) end bodyweight_percent,
      coalesce((select max(bodyweight_slots) from daily), 0) max_daily_bodyweight,
      coalesce((select jsonb_agg(bodyweight_slots order by day_position) from daily), '[]'::jsonb) daily_bodyweight
    from selected_plan cross join metrics
  )
  select jsonb_build_object(
    'status', case when not (
      gym_profile = 'STANDARD_COMMERCIAL_GYM' and workout_style = 'gym_first'
      and goal_code = 'muscle_gain'
    ) or (
      gym_percent >= 70 and bodyweight_percent <= 20
      and bodyweight_slots <= 2 and max_daily_bodyweight <= 1
      and core_posture_slots <= 2
    ) then 'PASS' else 'FAIL' end,
    'gymEquipmentSlots', gym_slots,
    'machineCableSlots', machine_slots,
    'freeWeightSlots', free_weight_slots,
    'bodyweightFloorSlots', bodyweight_slots,
    'specializedSlots', specialized_slots,
    'gymEquipmentPercent', gym_percent,
    'bodyweightPercent', bodyweight_percent,
    'corePostureSlots', core_posture_slots,
    'bodyweightFloorSlotsByDay', daily_bodyweight,
    'gymFirstExceptions', coalesce((select plan.generation_rationale #> '{quality,gymFirstExceptions}'
      from public.workout_plans plan where plan.id = p_plan_id), '[]'::jsonb)
  ) from evaluated;
$$;
revoke all on function private.calculate_gym_first_quality_v215(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;

create or replace function private.assert_plan_quality_v215(p_plan_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare quality jsonb; gym_quality jsonb; retained_avoid uuid;
begin
  select nullif(plan.generation_rationale #>> '{v213RetainedAvoid,exerciseId}', '')::uuid
    into retained_avoid from public.workout_plans plan where plan.id = p_plan_id;
  quality := private.assert_plan_quality_v213(p_plan_id, retained_avoid);
  gym_quality := private.calculate_gym_first_quality_v215(p_plan_id);
  if gym_quality->>'status' <> 'PASS' then
    raise exception 'GYM_FIRST_CONSTRAINT: composição comercial não atingiu os gates v2.1.5';
  end if;
  return quality || (gym_quality - 'status');
end;
$$;
revoke all on function private.assert_plan_quality_v215(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;

create or replace function private.create_plan_preview_v215(
  p_user_id uuid,
  p_days jsonb,
  p_generator_version text,
  p_rationale jsonb
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  preference public.training_preferences%rowtype;
  selected_goal text;
  plan_id uuid;
  day_id uuid;
  day_entry record;
  exercise_entry record;
  quality jsonb;
begin
  if p_user_id is null then raise exception 'Usuário inválido'; end if;
  if p_generator_version <> 'v2.1.5' then raise exception 'Versão do gerador inválida'; end if;
  if jsonb_typeof(p_days) <> 'array' then raise exception 'Plano inválido'; end if;

  select * into strict preference from public.training_preferences
    where user_id = p_user_id;
  select goal.goal_code into selected_goal from public.user_goals goal
    where goal.user_id = p_user_id and goal.active
    order by goal.priority, goal.goal_code limit 1;
  if selected_goal is null then raise exception 'Objetivo principal não encontrado'; end if;
  if jsonb_array_length(p_days) <> preference.sessions_per_week then
    raise exception 'Quantidade de dias diverge das preferências';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 215)
  );
  update public.workout_plans set status = 'archived', archived_at = now()
    where user_id = p_user_id and status = 'draft'
      and generator_version = 'v2.1.5';

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
      raise exception 'Dia sem exercícios';
    end if;
    insert into public.workout_days(workout_plan_id, name, position, estimated_minutes)
    values(plan_id, day_entry.value->>'name', day_entry.ordinality,
      (day_entry.value->>'estimatedMinutes')::smallint)
    returning id into day_id;

    for exercise_entry in
      select exercise.value, exercise.ordinality
      from jsonb_array_elements(day_entry.value->'exercises')
        with ordinality exercise(value, ordinality)
      order by exercise.ordinality
    loop
      if not private.exercise_auto_plan_eligible(
        (exercise_entry.value->>'exerciseId')::uuid, p_user_id
      ) then raise exception 'Plano contém exercício inelegível'; end if;
      insert into public.workout_day_exercises(
        workout_day_id, exercise_id, position, target_sets,
        rep_min, rep_max, rest_seconds, target_duration_seconds
      ) values (
        day_id, (exercise_entry.value->>'exerciseId')::uuid,
        exercise_entry.ordinality, (exercise_entry.value->>'sets')::smallint,
        nullif(exercise_entry.value->>'repMin', '0')::smallint,
        nullif(exercise_entry.value->>'repMax', '0')::smallint,
        (exercise_entry.value->>'restSeconds')::integer,
        (exercise_entry.value->>'targetDurationSeconds')::integer
      );
    end loop;
  end loop;

  quality := private.assert_plan_quality_v215(plan_id);
  update public.workout_plans set quality_metrics = quality where id = plan_id;
  return jsonb_build_object(
    'planId', plan_id, 'quality', quality, 'goal', selected_goal
  );
end;
$$;
revoke all on function private.create_plan_preview_v215(uuid,jsonb,text,jsonb)
  from public, anon, authenticated, service_role, supabase_auth_admin;

create or replace function public.create_plan_preview_v215(
  p_days jsonb,
  p_generator_version text,
  p_rationale jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  return private.create_plan_preview_v215(
    auth.uid(), p_days, p_generator_version, p_rationale
  );
end;
$$;
revoke all on function public.create_plan_preview_v215(jsonb,text,jsonb)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.create_plan_preview_v215(jsonb,text,jsonb)
  to authenticated;

create or replace function public.activate_plan_v215(p_plan_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := auth.uid(); quality jsonb;
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 215)
  );
  if not exists (
    select 1 from public.workout_plans plan
    where plan.id = p_plan_id and plan.user_id = current_user_id
      and plan.status = 'draft' and plan.generator_version = 'v2.1.5'
  ) then raise exception 'Preview de plano v2.1.5 não encontrado'; end if;

  quality := private.assert_plan_quality_v215(p_plan_id);
  update public.workout_plans set status = 'archived', archived_at = now()
    where user_id = current_user_id and status = 'active' and id <> p_plan_id;
  update public.workout_plans set status = 'active', activated_at = now(),
    archived_at = null, quality_metrics = quality
    where id = p_plan_id and user_id = current_user_id and status = 'draft';
  if not found then raise exception 'Falha ao ativar o novo plano'; end if;
  return jsonb_build_object('planId', p_plan_id, 'quality', quality);
end;
$$;
revoke all on function public.activate_plan_v215(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.activate_plan_v215(uuid) to authenticated;

create or replace function public.enforce_plan_activation()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare quality jsonb; goal_alignment jsonb; retained_avoid_exercise_id uuid;
begin
  if new.status = 'active'
     and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    if new.generator_version = 'v2.1.5' then
      new.quality_metrics := private.assert_plan_quality_v215(new.id);
      return new;
    end if;
    retained_avoid_exercise_id := nullif(
      new.generation_rationale #>> '{v213RetainedAvoid,exerciseId}', ''
    )::uuid;
    quality := private.calculate_plan_quality_v213(
      new.id, retained_avoid_exercise_id
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

create or replace function private.simulate_plan_replacement_v215(
  p_workout_day_exercise_id uuid,
  p_candidate_exercise_id uuid,
  p_user_id uuid
)
returns jsonb
language sql stable security definer set search_path = '' as $$
  with base as (
    select private.simulate_plan_replacement_v214(
      p_workout_day_exercise_id, p_candidate_exercise_id, p_user_id
    ) result
  ), context as (
    select plan.id plan_id, plan.generator_version, plan.goal_code,
      preference.gym_profile, preference.workout_style
    from public.workout_day_exercises selected_slot
    join public.workout_days selected_day on selected_day.id = selected_slot.workout_day_id
    join public.workout_plans plan on plan.id = selected_day.workout_plan_id
    join public.training_preferences preference on preference.user_id = plan.user_id
    where selected_slot.id = p_workout_day_exercise_id
      and plan.user_id = p_user_id and plan.status = 'active'
  ), virtual_slots as (
    select day.id day_id,
      case when item.id = p_workout_day_exercise_id
        then candidate.environment_profile else exercise.environment_profile end environment_profile,
      case when item.id = p_workout_day_exercise_id
        then candidate.gym_equipment_tier else exercise.gym_equipment_tier end gym_equipment_tier,
      case when item.id = p_workout_day_exercise_id
        then candidate.movement_pattern else exercise.movement_pattern end movement_pattern,
      case when item.id = p_workout_day_exercise_id
        then candidate.training_role else exercise.training_role end training_role
    from context
    join public.workout_days day on day.workout_plan_id = context.plan_id
    join public.workout_day_exercises item on item.workout_day_id = day.id
    join public.exercises exercise on exercise.id = item.exercise_id
    cross join public.exercises candidate
    where candidate.id = p_candidate_exercise_id
  ), metrics as (
    select count(*)::integer total_slots,
      count(*) filter (where gym_equipment_tier <= 2)::integer gym_slots,
      count(*) filter (where environment_profile in ('bodyweight_floor','bodyweight_station'))::integer bodyweight_slots,
      count(*) filter (where movement_pattern like 'core_%' or movement_pattern = 'posture'
        or training_role = 'postural_control')::integer core_posture_slots
    from virtual_slots
  ), daily as (
    select day_id, count(*) filter (where environment_profile in (
      'bodyweight_floor','bodyweight_station'
    ))::integer bodyweight_slots from virtual_slots group by day_id
  ), evaluated as (
    select base.result, context.*,
      case when metrics.total_slots = 0 then 0
        else round(100.0 * metrics.gym_slots / metrics.total_slots, 1) end gym_percent,
      case when metrics.total_slots = 0 then 0
        else round(100.0 * metrics.bodyweight_slots / metrics.total_slots, 1) end bodyweight_percent,
      metrics.bodyweight_slots, metrics.core_posture_slots,
      coalesce((select max(bodyweight_slots) from daily), 0) max_daily_bodyweight
    from base cross join context cross join metrics
  )
  select result || jsonb_build_object(
    'status', case when result->>'status' = 'PASS' and (
      not (generator_version = 'v2.1.5'
        and gym_profile = 'STANDARD_COMMERCIAL_GYM'
        and workout_style = 'gym_first' and goal_code = 'muscle_gain')
      or (gym_percent >= 70 and bodyweight_percent <= 20
        and bodyweight_slots <= 2 and max_daily_bodyweight <= 1
        and core_posture_slots <= 2)
    ) then 'PASS' else 'FAIL' end,
    'gymEquipmentPercent', gym_percent,
    'bodyweightPercent', bodyweight_percent,
    'bodyweightFloorSlots', bodyweight_slots,
    'corePostureSlots', core_posture_slots,
    'diagnostic', case when result->>'status' = 'PASS' and not (
      not (generator_version = 'v2.1.5'
        and gym_profile = 'STANDARD_COMMERCIAL_GYM'
        and workout_style = 'gym_first' and goal_code = 'muscle_gain')
      or (gym_percent >= 70 and bodyweight_percent <= 20
        and bodyweight_slots <= 2 and max_daily_bodyweight <= 1
        and core_posture_slots <= 2)
    ) then 'GYM_FIRST_CONSTRAINT' else null end
  ) from evaluated;
$$;
revoke all on function private.simulate_plan_replacement_v215(uuid,uuid,uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;

create or replace function private.plan_replacement_type_v214(
  p_workout_day_exercise_id uuid,
  p_candidate_exercise_id uuid,
  p_user_id uuid
)
returns text
language plpgsql stable security definer set search_path = '' as $$
declare source_exercise_id uuid; source_version text; simulation jsonb;
begin
  select slot.exercise_id, plan.generator_version
    into source_exercise_id, source_version
  from public.workout_day_exercises slot
  join public.workout_days day on day.id = slot.workout_day_id
  join public.workout_plans plan on plan.id = day.workout_plan_id
  where slot.id = p_workout_day_exercise_id
    and plan.user_id = p_user_id and plan.status = 'active';
  if source_exercise_id is null then raise exception 'Slot de plano ativo não encontrado'; end if;
  if source_version <> 'v2.1.5' and private.exercises_are_semantically_equivalent_v212(
    source_exercise_id, p_candidate_exercise_id
  ) then return 'DIRECT_EQUIVALENT'; end if;
  simulation := case when source_version = 'v2.1.5'
    then private.simulate_plan_replacement_v215(
      p_workout_day_exercise_id, p_candidate_exercise_id, p_user_id
    )
    else private.simulate_plan_replacement_v214(
      p_workout_day_exercise_id, p_candidate_exercise_id, p_user_id
    ) end;
  if simulation->>'status' = 'PASS' then
    if private.exercises_are_semantically_equivalent_v212(
      source_exercise_id, p_candidate_exercise_id
    ) then return 'DIRECT_EQUIVALENT'; end if;
    return 'GOAL_ALIGNED_ALTERNATIVE';
  end if;
  return 'REQUIRES_REBALANCE';
end;
$$;
revoke all on function private.plan_replacement_type_v214(uuid,uuid,uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;

create or replace function public.get_plan_replacement_candidates_v215(
  p_workout_day_exercise_id uuid,
  p_query text default null,
  p_limit integer default 12,
  p_offset integer default 0,
  p_reason_code text default 'user_choice'
)
returns table (
  exercise_id uuid, exercise_name text, movement_pattern text,
  training_role text, category text, difficulty text,
  primary_muscles text[], secondary_muscles text[], equipment_names text[],
  equipment_slugs text[], media_storage_path text, media_poster_path text,
  media_type text, replacement_type text, reason text,
  goal_alignment_reason text, total_count bigint
)
language plpgsql stable security definer set search_path = '' as $$
declare current_user_id uuid := auth.uid(); selected_goal text;
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  select coalesce(plan.goal_code, 'general_health') into selected_goal
  from public.workout_day_exercises slot
  join public.workout_days day on day.id = slot.workout_day_id
  join public.workout_plans plan on plan.id = day.workout_plan_id
  where slot.id = p_workout_day_exercise_id and plan.user_id = current_user_id;
  return query
  select candidate.*
  from private.plan_replacement_candidates_v214(
    p_workout_day_exercise_id, p_query, 30, 0, p_reason_code
  ) candidate
  order by case candidate.replacement_type
      when 'DIRECT_EQUIVALENT' then 0
      when 'GOAL_ALIGNED_ALTERNATIVE' then 1 else 2 end,
    private.exercise_gym_preference_score_v215(
      current_user_id, candidate.exercise_id, selected_goal
    ) desc,
    candidate.exercise_name, candidate.exercise_id
  limit p_limit offset p_offset;
end;
$$;
revoke all on function public.get_plan_replacement_candidates_v215(uuid,text,integer,integer,text)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.get_plan_replacement_candidates_v215(uuid,text,integer,integer,text)
  to authenticated;

create or replace function public.get_workout_replacement_candidates_v215(
  p_session_exercise_id uuid,
  p_reason_code text default 'user_choice',
  p_equipment_id uuid default null,
  p_query text default null,
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  exercise_id uuid, exercise_name text, movement_pattern text,
  training_role text, category text, difficulty text,
  primary_muscles text[], equipment_names text[], media_storage_path text,
  media_poster_path text, media_type text, replacement_type text,
  reason text, goal_alignment_reason text, total_count bigint
)
language plpgsql stable security definer set search_path = '' as $$
declare current_user_id uuid := auth.uid(); selected_goal text;
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  select coalesce(plan.goal_code, goal.goal_code, 'general_health') into selected_goal
  from public.workout_session_exercises item
  join public.workout_sessions session on session.id = item.workout_session_id
  left join public.workout_plans plan on plan.id = session.workout_plan_id
  left join lateral (
    select user_goal.goal_code from public.user_goals user_goal
    where user_goal.user_id = current_user_id and user_goal.active
    order by user_goal.priority, user_goal.goal_code limit 1
  ) goal on true
  where item.id = p_session_exercise_id and session.user_id = current_user_id;
  return query
  select candidate.*
  from private.workout_replacement_candidates_v214(
    p_session_exercise_id, p_reason_code, p_equipment_id, p_query, 30, 0
  ) candidate
  order by case candidate.replacement_type when 'DIRECT_EQUIVALENT' then 0 else 1 end,
    private.exercise_gym_preference_score_v215(
      current_user_id, candidate.exercise_id, selected_goal
    ) desc,
    candidate.exercise_name, candidate.exercise_id
  limit p_limit offset p_offset;
end;
$$;
revoke all on function public.get_workout_replacement_candidates_v215(uuid,text,uuid,text,integer,integer)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.get_workout_replacement_candidates_v215(uuid,text,uuid,text,integer,integer)
  to authenticated;

create or replace function public.replace_plan_exercise_v215(
  p_workout_day_exercise_id uuid,
  p_replacement_exercise_id uuid,
  p_replacement_type text,
  p_reason_code text default 'user_choice',
  p_persist_exclusion boolean default false
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := auth.uid(); source_version text; result jsonb; quality jsonb;
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  select plan.generator_version into source_version
  from public.workout_day_exercises slot
  join public.workout_days day on day.id = slot.workout_day_id
  join public.workout_plans plan on plan.id = day.workout_plan_id
  where slot.id = p_workout_day_exercise_id
    and plan.user_id = current_user_id and plan.status = 'active';
  result := public.replace_plan_exercise_v214(
    p_workout_day_exercise_id, p_replacement_exercise_id,
    p_replacement_type, p_reason_code, p_persist_exclusion
  );
  if source_version = 'v2.1.5' then
    update public.workout_plans set generator_version = 'v2.1.5',
      generation_rationale = generation_rationale || jsonb_build_object(
        'v215GymFirstChange', jsonb_build_object(
          'source', 'v2.1.5', 'workoutStyle', (
            select workout_style from public.training_preferences
            where user_id = current_user_id
          )
        )
      ), updated_at = now()
    where id = (result->>'planId')::uuid and user_id = current_user_id
      and status = 'active';
    quality := private.assert_plan_quality_v215((result->>'planId')::uuid);
    update public.workout_plans set quality_metrics = quality, updated_at = now()
      where id = (result->>'planId')::uuid;
    result := result || jsonb_build_object('quality', quality, 'generatorVersion', 'v2.1.5');
    update public.plan_exercise_change_events set
      metadata = metadata || jsonb_build_object('source', 'v2.1.5')
      where id = (result->>'eventId')::uuid and user_id = current_user_id;
  end if;
  return result;
end;
$$;
revoke all on function public.replace_plan_exercise_v215(uuid,uuid,text,text,boolean)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.replace_plan_exercise_v215(uuid,uuid,text,text,boolean)
  to authenticated;

create or replace function public.preview_plan_rebalance_v215(
  p_workout_day_exercise_id uuid,
  p_desired_exercise_id uuid,
  p_reason_code text default 'user_choice'
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  source_version text;
  source_exercise_id uuid;
  source_difficulty text;
  selected_goal text;
  cloned_source_slot_id uuid;
  best_replacement record;
  updated_changes jsonb;
  result jsonb;
  quality jsonb;
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  select plan.generator_version, slot.exercise_id, exercise.difficulty,
    coalesce(plan.goal_code, 'general_health')
  into source_version, source_exercise_id, source_difficulty, selected_goal
  from public.workout_day_exercises slot
  join public.workout_days day on day.id = slot.workout_day_id
  join public.workout_plans plan on plan.id = day.workout_plan_id
  join public.exercises exercise on exercise.id = slot.exercise_id
  where slot.id = p_workout_day_exercise_id
    and plan.user_id = current_user_id and plan.status = 'active';
  result := public.preview_plan_rebalance_v214(
    p_workout_day_exercise_id, p_desired_exercise_id, p_reason_code
  );
  if source_version = 'v2.1.5' then
    select nullif(plan.generation_rationale #>> '{v212ResultSlots,sourceSlotId}', '')::uuid
      into cloned_source_slot_id
    from public.workout_plans plan
    where plan.id = (result->>'planId')::uuid and plan.user_id = current_user_id;

    select candidate.id, candidate.name_pt into best_replacement
    from public.exercises candidate
    left join public.exercise_substitutions explicit
      on explicit.exercise_id = source_exercise_id
      and explicit.alternative_exercise_id = candidate.id
    where candidate.active and candidate.id <> p_desired_exercise_id
      and private.exercises_are_semantically_equivalent_v212(
        source_exercise_id, candidate.id
      )
      and private.exercise_media_is_ready(candidate.id)
      and private.exercise_auto_plan_eligible(candidate.id, current_user_id)
      and not exists (
        select 1 from public.workout_days day
        join public.workout_day_exercises slot on slot.workout_day_id = day.id
        where day.workout_plan_id = (result->>'planId')::uuid
          and slot.id <> cloned_source_slot_id
          and slot.exercise_id = candidate.id
      )
    order by private.exercise_gym_preference_score_v215(
        current_user_id, candidate.id, selected_goal
      ) desc,
      coalesce(explicit.score, 0) desc,
      (candidate.difficulty = source_difficulty) desc,
      candidate.name_pt, candidate.id
    limit 1;
    if found then
      update public.workout_day_exercises set exercise_id = best_replacement.id,
        updated_at = now() where id = cloned_source_slot_id;
      select jsonb_set(
        plan.generation_rationale #> '{v212Rebalance,changes}',
        '{0,after}', to_jsonb(best_replacement.name_pt), false
      ) into updated_changes
      from public.workout_plans plan where plan.id = (result->>'planId')::uuid;
      update public.workout_plans set generation_rationale = jsonb_set(
        generation_rationale, '{v212Rebalance,changes}', updated_changes, false
      ) where id = (result->>'planId')::uuid;
    end if;
    update public.workout_plans set generator_version = 'v2.1.5',
      generation_rationale = generation_rationale || jsonb_build_object(
        'v215GymFirstRebalance', jsonb_build_object(
          'source', 'v2.1.5', 'sourcePlanId', (
            select day.workout_plan_id from public.workout_day_exercises slot
            join public.workout_days day on day.id = slot.workout_day_id
            where slot.id = p_workout_day_exercise_id
          )
        )
      ), updated_at = now()
    where id = (result->>'planId')::uuid and user_id = current_user_id
      and status = 'draft';
    quality := private.assert_plan_quality_v215((result->>'planId')::uuid);
    update public.workout_plans set quality_metrics = quality, updated_at = now()
      where id = (result->>'planId')::uuid;
    result := result || jsonb_build_object(
      'quality', quality, 'generatorVersion', 'v2.1.5',
      'changes', coalesce(updated_changes, result->'changes')
    );
  end if;
  return result;
end;
$$;
revoke all on function public.preview_plan_rebalance_v215(uuid,uuid,text)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.preview_plan_rebalance_v215(uuid,uuid,text)
  to authenticated;

create or replace function public.activate_plan_rebalance_v215(p_plan_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := auth.uid(); is_v215 boolean; result jsonb; quality jsonb;
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  select plan.generator_version = 'v2.1.5'
    and plan.generation_rationale ? 'v215GymFirstRebalance'
    into is_v215
  from public.workout_plans plan
  where plan.id = p_plan_id and plan.user_id = current_user_id and plan.status = 'draft';
  if coalesce(is_v215, false) then
    update public.workout_plans set generator_version = 'v2.1.2'
      where id = p_plan_id and user_id = current_user_id and status = 'draft';
  end if;
  result := public.activate_plan_rebalance_v214(p_plan_id);
  if coalesce(is_v215, false) then
    update public.workout_plans set generator_version = 'v2.1.5', updated_at = now()
      where id = p_plan_id and user_id = current_user_id and status = 'active';
    quality := private.assert_plan_quality_v215(p_plan_id);
    update public.workout_plans set quality_metrics = quality, updated_at = now()
      where id = p_plan_id;
    result := result || jsonb_build_object('quality', quality, 'generatorVersion', 'v2.1.5');
    update public.plan_exercise_change_events set
      metadata = metadata || jsonb_build_object('source', 'v2.1.5')
      where id = (result->>'eventId')::uuid and user_id = current_user_id;
  end if;
  return result;
end;
$$;
revoke all on function public.activate_plan_rebalance_v215(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.activate_plan_rebalance_v215(uuid) to authenticated;

comment on column public.exercises.environment_profile is
  'Normalized execution environment used by generator and replacement ranking.';
comment on column public.exercises.gym_equipment_tier is
  'Commercial gym preference tier: 1 machine/cable, 2 free weight, 3 bodyweight, 4 specialized.';
comment on column public.exercises.technical_complexity is
  'Relative setup and execution complexity for ranking comparable exercises.';
comment on column public.exercises.goal_suitability is
  'Goals for which this exercise is a positive semantic candidate.';
comment on column public.training_preferences.workout_style is
  'User-selected equipment style: gym_first, mixed, or free_weight.';
comment on function public.create_plan_preview_v215(jsonb,text,jsonb) is
  'Creates a gym-first v2.1.5 draft without changing the active plan.';
comment on function public.activate_plan_v215(uuid) is
  'Activates a confirmed v2.1.5 preview only after all plan and gym-first gates pass.';

commit;
