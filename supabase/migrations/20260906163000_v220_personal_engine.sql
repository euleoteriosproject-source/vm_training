-- VM Training v2.2.0: deterministic, strategy-first personal programming engine.
-- Additive only: no historical plan, workout or performance row is removed.

alter table public.exercises
  add column if not exists exercise_family text,
  add column if not exists fatigue_profile text,
  add column if not exists stability_profile text;

update public.exercises
set exercise_family = coalesce(exercise_family, case
      when movement_pattern = 'horizontal_pull' then 'row'
      when movement_pattern = 'horizontal_push' then 'horizontal_press'
      when movement_pattern = 'vertical_pull' then 'vertical_pull'
      when movement_pattern = 'vertical_push' then 'vertical_press'
      else movement_pattern
    end),
    fatigue_profile = coalesce(fatigue_profile, case
      when technical_complexity = 'high' then 'high'
      when category = 'strength' then 'medium'
      else 'low'
    end),
    stability_profile = coalesce(stability_profile, case
      when environment_profile in ('commercial_machine','commercial_cable','cardio_machine') then 'high'
      when environment_profile = 'commercial_free_weight' then 'moderate'
      else 'low'
    end);

alter table public.exercises
  alter column exercise_family set default 'unclassified',
  alter column fatigue_profile set default 'medium',
  alter column stability_profile set default 'moderate',
  alter column exercise_family set not null,
  alter column fatigue_profile set not null,
  alter column stability_profile set not null,
  add constraint exercises_fatigue_profile_v220_check
    check (fatigue_profile in ('low','medium','high')),
  add constraint exercises_stability_profile_v220_check
    check (stability_profile in ('low','moderate','high'));

create or replace function private.normalize_exercise_programming_metadata_v220()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.exercise_family is null or new.exercise_family = 'unclassified' then
    new.exercise_family := case
      when new.movement_pattern = 'horizontal_pull' then 'row'
      when new.movement_pattern = 'horizontal_push' then 'horizontal_press'
      when new.movement_pattern = 'vertical_pull' then 'vertical_pull'
      when new.movement_pattern = 'vertical_push' then 'vertical_press'
      else new.movement_pattern
    end;
  end if;
  if new.fatigue_profile is null then
    new.fatigue_profile := case when new.technical_complexity = 'high' then 'high'
      when new.category = 'strength' then 'medium' else 'low' end;
  end if;
  if new.stability_profile is null then
    new.stability_profile := case
      when new.environment_profile in ('commercial_machine','commercial_cable','cardio_machine') then 'high'
      when new.environment_profile = 'commercial_free_weight' then 'moderate'
      else 'low' end;
  end if;
  return new;
end;
$$;
revoke all on function private.normalize_exercise_programming_metadata_v220()
  from public, anon, authenticated, service_role, supabase_auth_admin;

drop trigger if exists normalize_exercise_programming_metadata_v220 on public.exercises;
create trigger normalize_exercise_programming_metadata_v220
before insert or update of movement_pattern, category, technical_complexity,
  environment_profile, exercise_family, fatigue_profile, stability_profile
on public.exercises for each row
execute function private.normalize_exercise_programming_metadata_v220();

alter table public.workout_days
  add column if not exists programming_focus text,
  add column if not exists programming_rationale text;

alter table public.workout_day_exercises
  add column if not exists slot_role text,
  add column if not exists exercise_family text,
  add column if not exists selection_rationale text,
  add column if not exists progression_recommendation jsonb not null default '{}'::jsonb;

alter table public.workout_day_exercises
  add constraint workout_day_exercises_slot_role_v220_check check (
    slot_role is null or slot_role in (
      'PRIMARY_LOWER','PRIMARY_PUSH','PRIMARY_PULL','SECONDARY_LOWER',
      'SECONDARY_PUSH','SECONDARY_PULL','ACCESSORY','ISOLATION','CORE',
      'CONDITIONING','MOBILITY','CORRECTIVE'
    )
  );

alter table public.workout_session_exercises
  add column if not exists slot_role text,
  add column if not exists exercise_family text,
  add column if not exists selection_rationale text,
  add column if not exists progression_recommendation jsonb not null default '{}'::jsonb;

create or replace function public.get_auto_plan_catalog_v220()
returns table (
  id uuid, name text, pattern text, training_role text, category text,
  difficulty text, active boolean, media_ready boolean,
  auto_plan_eligible boolean, required_equipment text[],
  required_capabilities text[], eligibility_reasons text[],
  environment_profile text, gym_equipment_tier smallint,
  technical_complexity text, goal_suitability text[],
  primary_muscles text[], secondary_muscles text[], exercise_family text,
  fatigue_profile text, stability_profile text
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
    exercise.technical_complexity, exercise.goal_suitability,
    exercise.primary_muscles, exercise.secondary_muscles, exercise.exercise_family,
    exercise.fatigue_profile, exercise.stability_profile
  from public.exercises exercise
  order by exercise.name_pt, exercise.id;
end;
$$;
revoke all on function public.get_auto_plan_catalog_v220()
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.get_auto_plan_catalog_v220() to authenticated;

create or replace function private.assert_plan_quality_v220(p_plan_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare base_quality jsonb; engine_quality jsonb;
begin
  base_quality := private.assert_plan_quality_v215(p_plan_id);
  select coalesce(plan.generation_rationale->'quality', '{}'::jsonb)
    into engine_quality
  from public.workout_plans plan
  where plan.id = p_plan_id and plan.generator_version = 'v2.2.0';
  if not found then raise exception 'Preview de plano v2.2.0 não encontrado'; end if;
  if engine_quality->>'goalAlignment' is null
     or engine_quality #>> '{goalAlignment,status}' <> 'PASS'
     or engine_quality->>'weeklyBalanceStatus' <> 'PASS'
     or engine_quality->>'orderingStatus' <> 'PASS'
     or engine_quality->>'programQualityStatus' <> 'PASS' then
    raise exception 'PROGRAM_QUALITY_CONSTRAINT: gates v2.2.0 não foram atingidos';
  end if;
  if exists (
    select 1 from public.workout_days day
    join public.workout_day_exercises item on item.workout_day_id = day.id
    where day.workout_plan_id = p_plan_id
      and (item.slot_role is null or item.selection_rationale is null
        or btrim(item.selection_rationale) = '' or item.exercise_family is null)
  ) then raise exception 'PROGRAM_METADATA_CONSTRAINT: slot sem metadados v2.2.0'; end if;
  return base_quality || engine_quality;
end;
$$;
revoke all on function private.assert_plan_quality_v220(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;

create or replace function private.create_plan_preview_v220(
  p_user_id uuid,
  p_days jsonb,
  p_generator_version text,
  p_rationale jsonb
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb; plan_id uuid; quality jsonb;
begin
  if p_user_id is null then raise exception 'Usuário inválido'; end if;
  if p_generator_version <> 'v2.2.0' then raise exception 'Versão do gerador inválida'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 220));
  update public.workout_plans set status = 'archived', archived_at = now()
    where user_id = p_user_id and status = 'draft' and generator_version = 'v2.2.0';

  result := private.create_plan_preview_v215(p_user_id, p_days, 'v2.1.5', p_rationale);
  plan_id := (result->>'planId')::uuid;
  update public.workout_plans
    set generator_version = 'v2.2.0', generation_rationale = coalesce(p_rationale, '{}'::jsonb)
    where id = plan_id and user_id = p_user_id and status = 'draft';

  update public.workout_days day
    set programming_focus = source.value->>'focus',
        programming_rationale = source.value->>'rationale'
  from jsonb_array_elements(p_days) with ordinality source(value, ordinality)
  where day.workout_plan_id = plan_id and day.position = source.ordinality;

  update public.workout_day_exercises item
    set slot_role = exercise.value->>'slotRole',
        exercise_family = exercise.value->>'exerciseFamily',
        selection_rationale = exercise.value->>'rationale',
        progression_recommendation = coalesce(exercise.value->'progression', '{}'::jsonb)
  from public.workout_days day,
       jsonb_array_elements(p_days) with ordinality day_source(value, ordinality),
       jsonb_array_elements(day_source.value->'exercises') with ordinality exercise(value, ordinality)
  where day.workout_plan_id = plan_id
    and day.position = day_source.ordinality
    and item.workout_day_id = day.id
    and item.position = exercise.ordinality;

  quality := private.assert_plan_quality_v220(plan_id);
  update public.workout_plans set quality_metrics = quality where id = plan_id;
  return jsonb_build_object(
    'planId', plan_id, 'quality', quality,
    'goal', (select goal_code from public.workout_plans where id = plan_id)
  );
end;
$$;
revoke all on function private.create_plan_preview_v220(uuid,jsonb,text,jsonb)
  from public, anon, authenticated, service_role, supabase_auth_admin;

create or replace function public.create_plan_preview_v220(
  p_days jsonb,
  p_generator_version text,
  p_rationale jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  return private.create_plan_preview_v220(auth.uid(), p_days, p_generator_version, p_rationale);
end;
$$;
revoke all on function public.create_plan_preview_v220(jsonb,text,jsonb)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.create_plan_preview_v220(jsonb,text,jsonb) to authenticated;

create or replace function public.activate_plan_v220(p_plan_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := auth.uid(); quality jsonb;
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(current_user_id::text, 220));
  if not exists (
    select 1 from public.workout_plans plan
    where plan.id = p_plan_id and plan.user_id = current_user_id
      and plan.status = 'draft' and plan.generator_version = 'v2.2.0'
  ) then raise exception 'Preview de plano v2.2.0 não encontrado'; end if;
  quality := private.assert_plan_quality_v220(p_plan_id);
  update public.workout_plans set status = 'archived', archived_at = now()
    where user_id = current_user_id and status = 'active' and id <> p_plan_id;
  update public.workout_plans set status = 'active', activated_at = now(),
    archived_at = null, quality_metrics = quality
    where id = p_plan_id and user_id = current_user_id and status = 'draft';
  if not found then raise exception 'Falha ao ativar o novo plano'; end if;
  return jsonb_build_object('planId', p_plan_id, 'quality', quality);
end;
$$;
revoke all on function public.activate_plan_v220(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.activate_plan_v220(uuid) to authenticated;

create or replace function private.snapshot_programming_metadata_v220()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare planned public.workout_day_exercises%rowtype;
begin
  if tg_op = 'INSERT' then
    select item.* into planned
    from public.workout_sessions session
    join public.workout_day_exercises item
      on item.workout_day_id = session.workout_day_id and item.position = new.position
    where session.id = new.workout_session_id;
    new.slot_role := planned.slot_role;
    new.exercise_family := planned.exercise_family;
    new.selection_rationale := planned.selection_rationale;
    new.progression_recommendation := coalesce(
      planned.progression_recommendation,
      new.progression_recommendation,
      '{}'::jsonb
    );
  elsif new.actual_exercise_id is distinct from old.actual_exercise_id then
    select exercise.exercise_family into new.exercise_family
      from public.exercises exercise where exercise.id = new.actual_exercise_id;
    new.selection_rationale := coalesce(new.selection_rationale,
      'Substituição mantém o papel programado deste slot.');
  end if;
  return new;
end;
$$;
revoke all on function private.snapshot_programming_metadata_v220()
  from public, anon, authenticated, service_role, supabase_auth_admin;

drop trigger if exists snapshot_programming_metadata_v220 on public.workout_session_exercises;
create trigger snapshot_programming_metadata_v220
before insert or update of actual_exercise_id on public.workout_session_exercises
for each row execute function private.snapshot_programming_metadata_v220();

create or replace function private.enforce_v220_plan_activation()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.generator_version = 'v2.2.0' and new.status = 'active'
     and old.status is distinct from 'active' then
    new.quality_metrics := private.assert_plan_quality_v220(new.id);
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_v220_plan_activation()
  from public, anon, authenticated, service_role, supabase_auth_admin;

drop trigger if exists enforce_v220_plan_activation on public.workout_plans;
create trigger enforce_v220_plan_activation
before update of status on public.workout_plans
for each row execute function private.enforce_v220_plan_activation();

comment on function public.get_auto_plan_catalog_v220() is
  'Authenticated v2.2.0 catalog including muscles, family, fatigue and stability metadata.';
comment on function public.create_plan_preview_v220(jsonb,text,jsonb) is
  'Creates a v2.2.0 draft only. Activation is always a separate explicit operation.';
comment on function public.activate_plan_v220(uuid) is
  'Explicit owner-only activation after v2.1.5 and v2.2.0 quality validation.';
