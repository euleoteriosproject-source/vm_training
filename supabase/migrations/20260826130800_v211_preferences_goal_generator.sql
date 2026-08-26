-- VM Training v2.1.1: goal-driven generation, capability-based gym defaults,
-- atomic preference persistence, and preview-before-activation plan versioning.

begin;

alter table public.training_preferences
  add column if not exists gym_profile text not null default 'STANDARD_COMMERCIAL_GYM';
alter table public.training_preferences
  drop constraint if exists training_preferences_gym_profile_check;
alter table public.training_preferences
  add constraint training_preferences_gym_profile_check check (gym_profile in (
    'STANDARD_COMMERCIAL_GYM', 'BASIC_GYM', 'HOME_GYM', 'BODYWEIGHT_ONLY'
  ));

update public.training_preferences
set gym_profile = case gym_category
  when 'academia_essencial' then 'BASIC_GYM'
  when 'peso_livre_funcional' then 'HOME_GYM'
  else 'STANDARD_COMMERCIAL_GYM'
end;

alter table public.workout_plans
  add column if not exists goal_code text;

create table public.equipment_capabilities (
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  capability text not null,
  created_at timestamptz not null default now(),
  primary key (equipment_id, capability)
);

create table public.gym_capability_presets (
  gym_profile text not null check (gym_profile in (
    'STANDARD_COMMERCIAL_GYM', 'BASIC_GYM', 'HOME_GYM', 'BODYWEIGHT_ONLY'
  )),
  capability text not null,
  created_at timestamptz not null default now(),
  primary key (gym_profile, capability)
);

alter table public.equipment_capabilities enable row level security;
alter table public.gym_capability_presets enable row level security;

create policy "authenticated reads equipment capabilities"
  on public.equipment_capabilities for select to authenticated using (true);
create policy "authenticated reads gym capability presets"
  on public.gym_capability_presets for select to authenticated using (true);

revoke all privileges on table public.equipment_capabilities
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all privileges on table public.gym_capability_presets
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant select on table public.equipment_capabilities, public.gym_capability_presets
  to authenticated;
grant select, insert, update, delete on table public.equipment_capabilities,
  public.gym_capability_presets to service_role;

insert into public.equipment_capabilities(equipment_id, capability)
select equipment.id, mapping.capability
from (values
  ('bodyweight', 'bodyweight'),
  ('dumbbells', 'free_weights'), ('barbell', 'free_weights'),
  ('kettlebell', 'free_weights'), ('band', 'free_weights'),
  ('bench', 'bench'), ('cable', 'cable_system'),
  ('lat-pulldown', 'vertical_pull'), ('pull-up-bar', 'vertical_pull'),
  ('row-machine', 'horizontal_pull'), ('chest-press', 'horizontal_push'),
  ('smith', 'squat_pattern_machine_or_free_weight'),
  ('hack-squat', 'squat_pattern_machine_or_free_weight'),
  ('leg-press', 'leg_press'), ('leg-extension', 'knee_extension'),
  ('lying-leg-curl', 'knee_flexion'), ('seated-leg-curl', 'knee_flexion'),
  ('treadmill', 'cardio_machine'), ('bike', 'cardio_machine'),
  ('elliptical', 'cardio_machine'), ('abductor', 'hip_accessory'),
  ('adductor', 'hip_accessory'), ('back-extension-machine', 'hip_extension')
) mapping(equipment_slug, capability)
join public.equipment equipment on equipment.slug = mapping.equipment_slug
on conflict do nothing;

insert into public.gym_capability_presets(gym_profile, capability)
select profile, capability from (values
  ('STANDARD_COMMERCIAL_GYM', 'free_weights'),
  ('STANDARD_COMMERCIAL_GYM', 'bench'),
  ('STANDARD_COMMERCIAL_GYM', 'cable_system'),
  ('STANDARD_COMMERCIAL_GYM', 'vertical_pull'),
  ('STANDARD_COMMERCIAL_GYM', 'horizontal_pull'),
  ('STANDARD_COMMERCIAL_GYM', 'horizontal_push'),
  ('STANDARD_COMMERCIAL_GYM', 'vertical_push'),
  ('STANDARD_COMMERCIAL_GYM', 'squat_pattern_machine_or_free_weight'),
  ('STANDARD_COMMERCIAL_GYM', 'leg_press'),
  ('STANDARD_COMMERCIAL_GYM', 'knee_extension'),
  ('STANDARD_COMMERCIAL_GYM', 'knee_flexion'),
  ('STANDARD_COMMERCIAL_GYM', 'cardio_machine'),
  ('STANDARD_COMMERCIAL_GYM', 'bodyweight'),
  ('STANDARD_COMMERCIAL_GYM', 'hip_accessory'),
  ('STANDARD_COMMERCIAL_GYM', 'hip_extension'),
  ('BASIC_GYM', 'free_weights'), ('BASIC_GYM', 'bench'),
  ('BASIC_GYM', 'cable_system'), ('BASIC_GYM', 'cardio_machine'),
  ('BASIC_GYM', 'squat_pattern_machine_or_free_weight'),
  ('BASIC_GYM', 'bodyweight'),
  ('HOME_GYM', 'free_weights'), ('HOME_GYM', 'bench'),
  ('HOME_GYM', 'bodyweight'),
  ('BODYWEIGHT_ONLY', 'bodyweight')
) preset(profile, capability)
on conflict do nothing;

create or replace function private.user_equipment_is_available(
  p_user_id uuid,
  p_equipment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when equipment.slug = 'bodyweight' then true
    when override_row.user_id is not null then
      override_row.available and (
        override_row.temporary_unavailable_until is null
        or override_row.temporary_unavailable_until <= now()
      )
    else exists (
      select 1
      from public.equipment_capabilities capability
      join public.gym_capability_presets preset
        on preset.capability = capability.capability
      where capability.equipment_id = p_equipment_id
        and preset.gym_profile = preference.gym_profile
    )
  end
  from public.equipment equipment
  join public.training_preferences preference on preference.user_id = p_user_id
  left join public.user_equipment override_row
    on override_row.user_id = p_user_id
    and override_row.equipment_id = p_equipment_id
    and override_row.source = 'user_override'
  where equipment.id = p_equipment_id;
$$;

revoke all on function private.user_equipment_is_available(uuid, uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;

create or replace function private.exercise_auto_plan_reasons(
  p_exercise_id uuid,
  p_user_id uuid
)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_remove(array[
    case when not exercise.active then 'inactive' end,
    case when not private.exercise_media_is_ready(exercise.id) then 'media_not_ready' end,
    case when preference.user_id is null then 'training_preferences_missing' end,
    case when preference.experience = 'beginner' and exercise.difficulty = 'advanced'
      then 'difficulty_incompatible' end,
    case when coalesce(cardinality(exercise.execution_instructions), 0) = 0
      or coalesce(cardinality(exercise.primary_muscles), 0) = 0
      or nullif(btrim(exercise.movement_pattern), '') is null
      then 'programming_data_incomplete' end,
    case when exists (
      select 1 from public.user_exercise_preferences exercise_preference
      where exercise_preference.user_id = p_user_id
        and exercise_preference.exercise_id = exercise.id
        and exercise_preference.preference = 'avoid'
    ) then 'user_avoid' end,
    case when exists (
      select 1
      from public.exercise_equipment required_link
      where required_link.exercise_id = exercise.id
        and required_link.required
        and not private.user_equipment_is_available(
          p_user_id, required_link.equipment_id
        )
    ) then 'unavailable_equipment' end,
    case when exists (
      select 1 from public.user_movement_attention attention
      where attention.user_id = p_user_id and attention.active and (
        (attention.region = 'knee' and exercise.movement_pattern in ('squat','knee_extension','knee_flexion'))
        or (attention.region = 'shoulder' and exercise.movement_pattern in ('horizontal_push','vertical_push'))
        or (attention.region = 'lower_back' and exercise.movement_pattern in ('hinge','hip_extension','core_flexion'))
        or (attention.region = 'hip' and exercise.movement_pattern in ('squat','hinge','hip_extension'))
        or (attention.region = 'ankle' and exercise.movement_pattern in ('squat','knee_extension','cardio'))
        or (attention.region = 'wrist' and exercise.movement_pattern in ('horizontal_push','vertical_push','carry'))
      )
    ) then 'movement_attention' end
  ], null)
  from public.exercises exercise
  left join public.training_preferences preference on preference.user_id = p_user_id
  where exercise.id = p_exercise_id;
$$;

create or replace function public.get_auto_plan_catalog_v211()
returns table (
  id uuid,
  name text,
  pattern text,
  category text,
  difficulty text,
  active boolean,
  media_ready boolean,
  auto_plan_eligible boolean,
  required_equipment text[],
  required_capabilities text[],
  eligibility_reasons text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  return query
  select exercise.id, exercise.name_pt, exercise.movement_pattern,
    exercise.category, exercise.difficulty, exercise.active,
    private.exercise_media_is_ready(exercise.id),
    private.exercise_auto_plan_eligible(exercise.id, current_user_id),
    coalesce((
      select array_agg(equipment.slug order by equipment.slug)
      from public.exercise_equipment link
      join public.equipment equipment on equipment.id = link.equipment_id
      where link.exercise_id = exercise.id and link.required
    ), '{}'::text[]),
    coalesce((
      select array_agg(distinct capability.capability order by capability.capability)
      from public.exercise_equipment link
      join public.equipment_capabilities capability
        on capability.equipment_id = link.equipment_id
      where link.exercise_id = exercise.id and link.required
    ), '{}'::text[]),
    private.exercise_auto_plan_reasons(exercise.id, current_user_id)
  from public.exercises exercise
  order by exercise.name_pt, exercise.id;
end;
$$;

revoke all on function public.get_auto_plan_catalog_v211()
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.get_auto_plan_catalog_v211() to authenticated;

create or replace function public.save_training_preferences_v211(
  p_goal_code text,
  p_sessions_per_week smallint,
  p_session_minutes smallint,
  p_cardio_preference smallint,
  p_gym_profile text default 'STANDARD_COMMERCIAL_GYM'
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  if p_goal_code not in ('weight_loss','fat_loss','measurements','muscle_gain','strength','posture','mobility','conditioning','cardio_endurance','general_health') then
    raise exception 'Objetivo inválido';
  end if;
  if p_sessions_per_week not between 2 and 5 then raise exception 'Frequência inválida'; end if;
  if p_session_minutes not in (30,45,60,75,90) then raise exception 'Duração inválida'; end if;
  if p_cardio_preference not between 1 and 5 then raise exception 'Preferência de cardio inválida'; end if;
  if p_gym_profile not in ('STANDARD_COMMERCIAL_GYM','BASIC_GYM','HOME_GYM','BODYWEIGHT_ONLY') then
    raise exception 'Perfil de academia inválido';
  end if;

  update public.training_preferences set
    sessions_per_week = p_sessions_per_week,
    session_minutes = p_session_minutes,
    cardio_preference = p_cardio_preference,
    gym_profile = p_gym_profile,
    gym_category = case p_gym_profile
      when 'BASIC_GYM' then 'academia_essencial'
      when 'HOME_GYM' then 'peso_livre_funcional'
      when 'BODYWEIGHT_ONLY' then 'peso_livre_funcional'
      else 'academia_padrao'
    end,
    training_location = case p_gym_profile
      when 'BASIC_GYM' then 'small_gym'
      when 'HOME_GYM' then 'home'
      when 'BODYWEIGHT_ONLY' then 'home'
      else 'full_gym'
    end,
    updated_at = now()
  where user_id = current_user_id;
  if not found then raise exception 'Preferências não encontradas'; end if;

  update public.user_goals set active = false, updated_at = now()
  where user_id = current_user_id and active;
  insert into public.user_goals(user_id, goal_code, priority, active)
  values(current_user_id, p_goal_code, 1, true)
  on conflict(user_id, goal_code) do update set
    priority = 1, active = true, updated_at = now();

  return jsonb_build_object(
    'goal', p_goal_code,
    'sessionsPerWeek', p_sessions_per_week,
    'sessionMinutes', p_session_minutes,
    'cardioPreference', p_cardio_preference,
    'gymProfile', p_gym_profile
  );
end;
$$;

revoke all on function public.save_training_preferences_v211(text,smallint,smallint,smallint,text)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.save_training_preferences_v211(text,smallint,smallint,smallint,text)
  to authenticated;

create or replace function private.calculate_goal_alignment_v211(p_plan_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with selected_plan as (
    select plan.id, plan.goal_code
    from public.workout_plans plan where plan.id = p_plan_id
  ), slots as (
    select exercise.category, exercise.movement_pattern,
      item.rep_min, item.rep_max, item.rest_seconds
    from public.workout_days day
    join selected_plan plan on plan.id = day.workout_plan_id
    join public.workout_day_exercises item on item.workout_day_id = day.id
    join public.exercises exercise on exercise.id = item.exercise_id
  ), metrics as (
    select
      count(*)::integer total_slots,
      count(*) filter (where category = 'strength')::integer strength_slots,
      count(*) filter (where category = 'cardio')::integer cardio_slots,
      count(*) filter (where category = 'mobility' or movement_pattern = 'posture')::integer mobility_slots,
      count(*) filter (where category = 'strength' and rep_max between 1 and 8)::integer lower_rep_slots,
      count(*) filter (where category = 'strength' and rep_min >= 8 and rep_max <= 15)::integer moderate_rep_slots,
      count(*) filter (where category = 'strength' and rest_seconds >= 105)::integer long_rest_slots
    from slots
  ), evaluated as (
    select plan.goal_code, metrics.*,
      case
        when plan.goal_code = 'strength' then
          strength_slots >= total_slots * 0.75
          and lower_rep_slots >= strength_slots * 0.5
          and long_rest_slots >= strength_slots * 0.5
        when plan.goal_code = 'muscle_gain' then
          strength_slots >= total_slots * 0.75
          and moderate_rep_slots >= strength_slots * 0.7
        when plan.goal_code in ('conditioning','cardio_endurance','fat_loss','weight_loss','measurements') then
          cardio_slots >= (select count(*) from public.workout_days day where day.workout_plan_id = p_plan_id)
          and strength_slots >= (select count(*) * 2 from public.workout_days day where day.workout_plan_id = p_plan_id)
        when plan.goal_code in ('mobility','posture') then
          mobility_slots >= (select count(*) from public.workout_days day where day.workout_plan_id = p_plan_id)
          and strength_slots >= (select count(*) * 3 from public.workout_days day where day.workout_plan_id = p_plan_id)
        else
          strength_slots >= (select count(*) * 3 from public.workout_days day where day.workout_plan_id = p_plan_id)
          and ((select count(*) from public.workout_days day where day.workout_plan_id = p_plan_id) < 3 or mobility_slots >= 1)
          and ((select count(*) from public.workout_days day where day.workout_plan_id = p_plan_id) < 3 or cardio_slots >= 1)
      end as aligned
    from selected_plan plan cross join metrics
  )
  select jsonb_build_object(
    'status', case when aligned then 'PASS' else 'FAIL' end,
    'goal', goal_code,
    'strengthSlots', strength_slots,
    'cardioSlots', cardio_slots,
    'mobilityOrPostureSlots', mobility_slots,
    'lowerRepStrengthSlots', lower_rep_slots,
    'moderateRepStrengthSlots', moderate_rep_slots,
    'longRestStrengthSlots', long_rest_slots
  ) from evaluated;
$$;

revoke all on function private.calculate_goal_alignment_v211(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;

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
    if new.generator_version = 'v2.1.1' then
      goal_alignment := private.calculate_goal_alignment_v211(new.id);
      if goal_alignment->>'status' <> 'PASS' then
        raise exception 'Plano v2.1.1 bloqueado: objetivo não refletido na programação';
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

create or replace function private.create_plan_preview_v211(
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
  goal_alignment jsonb;
begin
  if p_user_id is null then raise exception 'Usuário inválido'; end if;
  if p_generator_version <> 'v2.1.1' then raise exception 'Versão do gerador inválida'; end if;
  if jsonb_typeof(p_days) <> 'array' then raise exception 'Plano inválido'; end if;

  select * into strict preference from public.training_preferences
  where user_id = p_user_id;
  select goal.goal_code into selected_goal
  from public.user_goals goal
  where goal.user_id = p_user_id and goal.active
  order by goal.priority, goal.goal_code limit 1;
  if selected_goal is null then raise exception 'Objetivo principal não encontrado'; end if;
  if jsonb_array_length(p_days) <> preference.sessions_per_week then
    raise exception 'Quantidade de dias diverge das preferências';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 211));

  update public.workout_plans set status = 'archived', archived_at = now()
  where user_id = p_user_id and status = 'draft' and generator_version = 'v2.1.1';

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

  quality := private.calculate_plan_quality(plan_id);
  goal_alignment := private.calculate_goal_alignment_v211(plan_id);
  quality := quality || jsonb_build_object('goalAlignment', goal_alignment);
  if coalesce((quality->>'mediaCoveragePercent')::numeric, 0) <> 100
     or jsonb_array_length(quality->'ineligibleExercises') <> 0
     or jsonb_array_length(quality->'invalidEquipment') <> 0 then
    raise exception 'Plano v2.1.1 falhou nos gates de elegibilidade';
  end if;
  if goal_alignment->>'status' <> 'PASS' then
    raise exception 'Plano v2.1.1 falhou no alinhamento ao objetivo';
  end if;
  if preference.sessions_per_week = 3 and preference.session_minutes = 60 and (
    coalesce((quality->>'totalSlots')::integer, 0) <> 18
    or coalesce((quality->>'uniqueExercises')::integer, 0) < 12
    or coalesce((quality->>'maxExactExerciseFrequency')::integer, 0) > 2
    or jsonb_array_length(quality->'exactExerciseOnAllDays') <> 0
    or coalesce((quality->>'maxDayPairOverlapPercent')::numeric, 100) > 50
    or coalesce((quality->>'movementPatternCount')::integer, 0) < 8
  ) then raise exception 'Plano v2.1.1 falhou nos gates de diversidade'; end if;

  update public.workout_plans set quality_metrics = quality where id = plan_id;
  return jsonb_build_object('planId', plan_id, 'quality', quality, 'goal', selected_goal);
end;
$$;

revoke all on function private.create_plan_preview_v211(uuid,jsonb,text,jsonb)
  from public, anon, authenticated, service_role, supabase_auth_admin;

create or replace function public.create_plan_preview_v211(
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
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  return private.create_plan_preview_v211(
    auth.uid(), p_days, p_generator_version, p_rationale
  );
end;
$$;

create or replace function public.activate_plan_v211(p_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare current_user_id uuid := auth.uid(); quality jsonb; goal_alignment jsonb;
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(current_user_id::text, 211));
  if not exists (
    select 1 from public.workout_plans plan
    where plan.id = p_plan_id and plan.user_id = current_user_id
      and plan.status = 'draft' and plan.generator_version = 'v2.1.1'
  ) then raise exception 'Preview de plano não encontrado'; end if;

  quality := private.calculate_plan_quality(p_plan_id);
  goal_alignment := private.calculate_goal_alignment_v211(p_plan_id);
  quality := quality || jsonb_build_object('goalAlignment', goal_alignment);
  if coalesce((quality->>'mediaCoveragePercent')::numeric, 0) <> 100
     or jsonb_array_length(quality->'ineligibleExercises') <> 0
     or jsonb_array_length(quality->'invalidEquipment') <> 0
     or goal_alignment->>'status' <> 'PASS' then
    raise exception 'Preview deixou de atender aos gates de ativação';
  end if;

  update public.workout_plans set status = 'archived', archived_at = now()
  where user_id = current_user_id and status = 'active' and id <> p_plan_id;
  update public.workout_plans set
    status = 'active', activated_at = now(), archived_at = null,
    quality_metrics = quality
  where id = p_plan_id and user_id = current_user_id and status = 'draft';
  if not found then raise exception 'Falha ao ativar o novo plano'; end if;
  return jsonb_build_object('planId', p_plan_id, 'quality', quality);
end;
$$;

revoke all on function public.create_plan_preview_v211(jsonb,text,jsonb)
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function public.activate_plan_v211(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.create_plan_preview_v211(jsonb,text,jsonb)
  to authenticated;
grant execute on function public.activate_plan_v211(uuid) to authenticated;

comment on table public.equipment_capabilities is
  'Capability groups decouple plan compatibility from machine brands and models.';
comment on function public.save_training_preferences_v211(text,smallint,smallint,smallint,text) is
  'Atomically persists goal and simplified preferences without deleting equipment history.';
comment on function public.create_plan_preview_v211(jsonb,text,jsonb) is
  'Creates and validates a v2.1.1 draft while preserving the active plan.';
comment on function public.activate_plan_v211(uuid) is
  'Atomically activates a confirmed v2.1.1 preview and archives the prior active version.';

commit;
