-- VM Training v2.1: canonical media readiness, per-user auto-plan
-- eligibility, deterministic plan quality, and atomic plan versioning.

begin;

alter table public.workout_plans
  add column if not exists generator_version text,
  add column if not exists quality_metrics jsonb not null default '{}'::jsonb,
  add column if not exists generation_rationale jsonb not null default '{}'::jsonb;

create or replace function private.exercise_media_is_ready(p_exercise_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) = 1
  from public.exercise_media media
  join public.media_licenses license on license.code = media.license_code
  where media.exercise_id = p_exercise_id
    and media.status = 'approved'
    and media.execution_quality = 'approved'
    and media.media_role = 'PRIMARY_DEMO'
    and media.is_primary
    and media.review_state = 'PUBLISHED'
    and public.is_valid_animated_primary(media)
    and license.active
    and nullif(btrim(media.source_name), '') is not null
    and nullif(btrim(media.source_url), '') is not null
    and nullif(btrim(media.author), '') is not null
    and nullif(btrim(media.attribution_text), '') is not null
    and media.content_hash ~ '^[0-9a-f]{64}$'
    and nullif(btrim(media.storage_path), '') is not null
    and nullif(btrim(media.poster_path), '') is not null
    and public.is_valid_primary_checklist(media.review_checklist)
    and (
      (media.review_method = 'human' and media.reviewed_by is not null)
      or (
        media.review_method = 'automated'
        and media.reviewed_by is null
        and media.validation_confidence = 'HIGH'
        and private.is_valid_automated_media_validation(media.automated_validation)
      )
    )
    and exists (
      select 1 from storage.objects object
      where object.bucket_id = 'exercise-media'
        and object.name = media.storage_path
    )
    and exists (
      select 1 from storage.objects object
      where object.bucket_id = 'exercise-media'
        and object.name = media.poster_path
    );
$$;

create or replace function public.exercise_has_approved_primary(p_exercise_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.exercise_media_is_ready(p_exercise_id);
$$;

revoke all on function private.exercise_media_is_ready(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function public.exercise_has_approved_primary(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.exercise_has_approved_primary(uuid)
  to authenticated, service_role;

drop view if exists public.exercise_media_readiness;
create view public.exercise_media_readiness
with (security_invoker = true)
as
select
  exercise.id as exercise_id,
  exercise.slug,
  exercise.active,
  public.exercise_has_approved_primary(exercise.id) as media_ready,
  count(media.id) filter (
    where media.status = 'approved'
      and media.execution_quality = 'approved'
      and media.media_role = 'PRIMARY_DEMO'
      and media.is_primary
  )::integer as approved_primary_count
from public.exercises exercise
left join public.exercise_media media on media.exercise_id = exercise.id
group by exercise.id, exercise.slug, exercise.active;

revoke all on table public.exercise_media_readiness
  from public, anon, authenticated, service_role;
grant select on table public.exercise_media_readiness
  to authenticated, service_role;

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
    case
      when preference.experience = 'beginner' and exercise.difficulty = 'advanced'
      then 'difficulty_incompatible'
    end,
    case when coalesce(cardinality(exercise.execution_instructions), 0) = 0
      or coalesce(cardinality(exercise.primary_muscles), 0) = 0
      or nullif(btrim(exercise.movement_pattern), '') is null
      then 'programming_data_incomplete'
    end,
    case when exists (
      select 1
      from public.user_exercise_preferences exercise_preference
      where exercise_preference.user_id = p_user_id
        and exercise_preference.exercise_id = exercise.id
        and exercise_preference.preference = 'avoid'
    ) then 'user_avoid' end,
    case when exists (
      select 1
      from public.exercise_equipment required_link
      join public.equipment equipment on equipment.id = required_link.equipment_id
      where required_link.exercise_id = exercise.id
        and required_link.required
        and equipment.slug <> 'bodyweight'
        and not exists (
          select 1
          from public.user_equipment available_equipment
          where available_equipment.user_id = p_user_id
            and available_equipment.equipment_id = required_link.equipment_id
            and available_equipment.available
            and (
              available_equipment.temporary_unavailable_until is null
              or available_equipment.temporary_unavailable_until <= now()
            )
        )
    ) then 'unavailable_equipment' end,
    case when exists (
      select 1
      from public.user_movement_attention attention
      where attention.user_id = p_user_id
        and attention.active
        and (
          (attention.region = 'knee' and exercise.movement_pattern in (
            'squat', 'knee_extension', 'knee_flexion'
          ))
          or (attention.region = 'shoulder' and exercise.movement_pattern in (
            'horizontal_push', 'vertical_push'
          ))
          or (attention.region = 'lower_back' and exercise.movement_pattern in (
            'hinge', 'hip_extension', 'core_flexion'
          ))
          or (attention.region = 'hip' and exercise.movement_pattern in (
            'squat', 'hinge', 'hip_extension'
          ))
          or (attention.region = 'ankle' and exercise.movement_pattern in (
            'squat', 'knee_extension', 'cardio'
          ))
          or (attention.region = 'wrist' and exercise.movement_pattern in (
            'horizontal_push', 'vertical_push', 'carry'
          ))
        )
    ) then 'movement_attention' end
  ], null)
  from public.exercises exercise
  left join public.training_preferences preference on preference.user_id = p_user_id
  where exercise.id = p_exercise_id;
$$;

create or replace function private.exercise_auto_plan_eligible(
  p_exercise_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(cardinality(
    private.exercise_auto_plan_reasons(p_exercise_id, p_user_id)
  ), 0) = 0;
$$;

revoke all on function private.exercise_auto_plan_reasons(uuid, uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function private.exercise_auto_plan_eligible(uuid, uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;

create or replace function public.is_auto_plan_eligible(p_exercise_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  return private.exercise_auto_plan_eligible(p_exercise_id, current_user_id);
end;
$$;

create or replace function public.get_auto_plan_catalog()
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
  eligibility_reasons text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  return query
  select
    exercise.id,
    exercise.name_pt,
    exercise.movement_pattern,
    exercise.category,
    exercise.difficulty,
    exercise.active,
    private.exercise_media_is_ready(exercise.id),
    private.exercise_auto_plan_eligible(exercise.id, current_user_id),
    coalesce((
      select array_agg(equipment.slug order by equipment.slug)
      from public.exercise_equipment link
      join public.equipment equipment on equipment.id = link.equipment_id
      where link.exercise_id = exercise.id and link.required
    ), '{}'::text[]),
    private.exercise_auto_plan_reasons(exercise.id, current_user_id)
  from public.exercises exercise
  order by exercise.name_pt, exercise.id;
end;
$$;

revoke all on function public.is_auto_plan_eligible(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function public.get_auto_plan_catalog()
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.is_auto_plan_eligible(uuid) to authenticated;
grant execute on function public.get_auto_plan_catalog() to authenticated;

create or replace function private.calculate_plan_quality(p_plan_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with selected_plan as (
    select plan.id, plan.user_id
    from public.workout_plans plan
    where plan.id = p_plan_id
  ), plan_days as (
    select day.id, day.name, day.position
    from public.workout_days day
    join selected_plan plan on plan.id = day.workout_plan_id
  ), slots as (
    select
      day.id as day_id,
      day.name as day_name,
      day.position as day_position,
      item.exercise_id,
      exercise.movement_pattern,
      private.exercise_media_is_ready(item.exercise_id) as media_ready,
      private.exercise_auto_plan_eligible(
        item.exercise_id,
        (select user_id from selected_plan)
      ) as eligible,
      'unavailable_equipment' = any(private.exercise_auto_plan_reasons(
        item.exercise_id,
        (select user_id from selected_plan)
      )) as invalid_equipment
    from plan_days day
    join public.workout_day_exercises item on item.workout_day_id = day.id
    join public.exercises exercise on exercise.id = item.exercise_id
  ), frequency as (
    select exercise_id, count(*)::integer as uses,
      count(distinct day_id)::integer as days_used
    from slots group by exercise_id
  ), day_sizes as (
    select day_id, day_name, day_position, count(distinct exercise_id)::numeric as size
    from slots group by day_id, day_name, day_position
  ), day_pairs as (
    select
      left_day.day_name || ' x ' || right_day.day_name as pair,
      case when least(left_day.size, right_day.size) = 0 then 0 else round(
        100.0 * count(distinct left_slot.exercise_id) filter (
          where right_slot.exercise_id is not null
        ) / least(left_day.size, right_day.size),
        1
      ) end as overlap
    from day_sizes left_day
    join day_sizes right_day on right_day.day_position > left_day.day_position
    left join slots left_slot on left_slot.day_id = left_day.day_id
    left join slots right_slot on right_slot.day_id = right_day.day_id
      and right_slot.exercise_id = left_slot.exercise_id
    group by left_day.day_name, right_day.day_name,
      left_day.day_position, right_day.day_position,
      left_day.size, right_day.size
  ), movement as (
    select movement_pattern, count(*)::integer as slots
    from slots group by movement_pattern
  )
  select jsonb_build_object(
    'totalSlots', (select count(*) from slots),
    'uniqueExercises', (select count(*) from frequency),
    'uniquenessPercent', case when (select count(*) from slots) = 0 then 0 else
      round(100.0 * (select count(*) from frequency) / (select count(*) from slots), 1) end,
    'maxExactExerciseFrequency', coalesce((select max(uses) from frequency), 0),
    'exactExerciseOnAllDays', coalesce((
      select jsonb_agg(exercise.slug order by exercise.slug)
      from frequency
      join public.exercises exercise on exercise.id = frequency.exercise_id
      where frequency.days_used = (select count(*) from plan_days)
        and (select count(*) from plan_days) > 1
    ), '[]'::jsonb),
    'dayPairOverlapPercent', coalesce((
      select jsonb_object_agg(pair, overlap order by pair) from day_pairs
    ), '{}'::jsonb),
    'maxDayPairOverlapPercent', coalesce((select max(overlap) from day_pairs), 0),
    'movementPatternCount', (select count(*) from movement),
    'movementPatternDistribution', coalesce((
      select jsonb_object_agg(movement_pattern, slots order by movement_pattern)
      from movement
    ), '{}'::jsonb),
    'mediaCoveragePercent', case when (select count(*) from slots) = 0 then 0 else
      round(100.0 * (select count(*) from slots where media_ready) /
        (select count(*) from slots), 1) end,
    'invalidEquipment', coalesce((
      select jsonb_agg(invalid.exercise_id order by invalid.exercise_id)
      from (
        select distinct exercise_id from slots where invalid_equipment
      ) invalid
    ), '[]'::jsonb),
    'ineligibleExercises', coalesce((
      select jsonb_agg(ineligible.exercise_id order by ineligible.exercise_id)
      from (
        select distinct exercise_id from slots where not eligible
      ) ineligible
    ), '[]'::jsonb)
  );
$$;

revoke all on function private.calculate_plan_quality(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;

create or replace function public.get_plan_quality(p_plan_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.workout_plans plan
    where plan.id = p_plan_id and plan.user_id = auth.uid()
  ) then raise exception 'Plano não encontrado'; end if;
  return private.calculate_plan_quality(p_plan_id);
end;
$$;

revoke all on function public.get_plan_quality(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.get_plan_quality(uuid) to authenticated;

create or replace function public.enforce_plan_activation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  quality jsonb;
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
    new.quality_metrics := quality;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_plan_activation()
  from public, anon, authenticated, service_role, supabase_auth_admin;

create or replace function private.create_and_activate_plan_v21(
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
  plan_id uuid;
  day_id uuid;
  day_entry record;
  exercise_entry record;
  quality jsonb;
begin
  if p_user_id is null then raise exception 'Usuário inválido'; end if;
  if p_generator_version <> 'v2.1.0' then
    raise exception 'Versão do gerador inválida';
  end if;
  if jsonb_typeof(p_days) <> 'array' then raise exception 'Plano inválido'; end if;

  select * into strict preference
  from public.training_preferences
  where user_id = p_user_id;
  if jsonb_array_length(p_days) <> preference.sessions_per_week then
    raise exception 'Quantidade de dias diverge das preferências';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 21)
  );

  insert into public.workout_plans(
    user_id, name, status, source, sessions_per_week, target_session_minutes,
    generator_version, generation_rationale
  ) values (
    p_user_id, 'Meu plano', 'draft', 'generated', preference.sessions_per_week,
    preference.session_minutes, p_generator_version, coalesce(p_rationale, '{}'::jsonb)
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
    insert into public.workout_days(
      workout_plan_id, name, position, estimated_minutes
    ) values (
      plan_id,
      day_entry.value->>'name',
      day_entry.ordinality,
      (day_entry.value->>'estimatedMinutes')::smallint
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
      ) then raise exception 'Plano contém exercício inelegível'; end if;
      insert into public.workout_day_exercises(
        workout_day_id, exercise_id, position, target_sets,
        rep_min, rep_max, rest_seconds, target_duration_seconds
      ) values (
        day_id,
        (exercise_entry.value->>'exerciseId')::uuid,
        exercise_entry.ordinality,
        (exercise_entry.value->>'sets')::smallint,
        nullif(exercise_entry.value->>'repMin', '0')::smallint,
        nullif(exercise_entry.value->>'repMax', '0')::smallint,
        (exercise_entry.value->>'restSeconds')::integer,
        (exercise_entry.value->>'targetDurationSeconds')::integer
      );
    end loop;
  end loop;

  quality := private.calculate_plan_quality(plan_id);
  if coalesce((quality->>'mediaCoveragePercent')::numeric, 0) <> 100
     or jsonb_array_length(quality->'ineligibleExercises') <> 0
     or jsonb_array_length(quality->'invalidEquipment') <> 0 then
    raise exception 'Plano v2.1 falhou nos gates de elegibilidade';
  end if;
  if preference.sessions_per_week = 3 and preference.session_minutes = 60
     and (
       coalesce((quality->>'totalSlots')::integer, 0) <> 18
       or coalesce((quality->>'uniqueExercises')::integer, 0) < 12
       or coalesce((quality->>'maxExactExerciseFrequency')::integer, 0) > 2
       or jsonb_array_length(quality->'exactExerciseOnAllDays') <> 0
       or coalesce((quality->>'maxDayPairOverlapPercent')::numeric, 100) > 50
       or coalesce((quality->>'movementPatternCount')::integer, 0) < 8
     ) then raise exception 'Plano v2.1 falhou nos gates de diversidade'; end if;

  update public.workout_plans set quality_metrics = quality where id = plan_id;
  update public.workout_plans
  set status = 'archived', archived_at = now()
  where user_id = p_user_id and status = 'active' and id <> plan_id;
  update public.workout_plans
  set status = 'active', activated_at = now(), archived_at = null
  where id = plan_id and user_id = p_user_id and status = 'draft';
  if not found then raise exception 'Falha ao promover plano v2.1'; end if;

  return jsonb_build_object('planId', plan_id, 'quality', quality);
end;
$$;

revoke all on function private.create_and_activate_plan_v21(uuid, jsonb, text, jsonb)
  from public, anon, authenticated, service_role, supabase_auth_admin;

create or replace function public.create_and_activate_plan_v21(
  p_days jsonb,
  p_generator_version text,
  p_rationale jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  return private.create_and_activate_plan_v21(
    current_user_id, p_days, p_generator_version, p_rationale
  );
end;
$$;

revoke all on function public.create_and_activate_plan_v21(jsonb, text, jsonb)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.create_and_activate_plan_v21(jsonb, text, jsonb)
  to authenticated;

create or replace function public.get_v21_plan_reconciliation_input()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
  admin_count integer;
  result jsonb;
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    raise exception 'Acesso restrito ao service role';
  end if;
  select count(*)::integer, min(profile.user_id::text)::uuid
  into admin_count, target_user_id
  from public.profiles profile
  where profile.role = 'admin' and profile.onboarding_completed;
  if admin_count <> 1 then
    raise exception 'Esperado um admin com onboarding completo; encontrados %', admin_count;
  end if;

  select jsonb_build_object(
    'userId', target_user_id,
    'preferences', (
      select jsonb_build_object(
        'sessionsPerWeek', preference.sessions_per_week,
        'sessionMinutes', preference.session_minutes,
        'cardioPreference', preference.cardio_preference,
        'experience', preference.experience
      ) from public.training_preferences preference
      where preference.user_id = target_user_id
    ),
    'goals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', goal.goal_code, 'priority', goal.priority
      ) order by goal.priority, goal.goal_code)
      from public.user_goals goal
      where goal.user_id = target_user_id and goal.active
    ), '[]'::jsonb),
    'equipment', coalesce((
      select jsonb_agg(equipment.slug order by equipment.slug)
      from public.user_equipment user_equipment
      join public.equipment equipment on equipment.id = user_equipment.equipment_id
      where user_equipment.user_id = target_user_id
        and user_equipment.available
        and (
          user_equipment.temporary_unavailable_until is null
          or user_equipment.temporary_unavailable_until <= now()
        )
    ), '[]'::jsonb),
    'exercisePreferences', coalesce((
      select jsonb_agg(jsonb_build_object(
        'exerciseId', exercise_preference.exercise_id,
        'preference', exercise_preference.preference
      ) order by exercise_preference.exercise_id)
      from public.user_exercise_preferences exercise_preference
      where exercise_preference.user_id = target_user_id
    ), '[]'::jsonb),
    'movementAttentionPatterns', coalesce((
      select jsonb_agg(distinct pattern)
      from public.user_movement_attention attention
      cross join lateral unnest(case attention.region
        when 'knee' then array['squat','knee_extension','knee_flexion']
        when 'shoulder' then array['horizontal_push','vertical_push']
        when 'lower_back' then array['hinge','hip_extension','core_flexion']
        when 'hip' then array['squat','hinge','hip_extension']
        when 'ankle' then array['squat','knee_extension','cardio']
        when 'wrist' then array['horizontal_push','vertical_push','carry']
        else '{}'::text[] end) pattern
      where attention.user_id = target_user_id and attention.active
    ), '[]'::jsonb),
    'recentExerciseIds', coalesce((
      select jsonb_agg(distinct recent.exercise_id)
      from (
        select session_exercise.actual_exercise_id as exercise_id
        from public.workout_sessions session
        join public.workout_session_exercises session_exercise
          on session_exercise.workout_session_id = session.id
        where session.user_id = target_user_id
          and session.status in ('completed', 'cancelled')
        order by session.started_at desc
        limit 60
      ) recent
    ), '[]'::jsonb),
    'catalog', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', exercise.id,
        'name', exercise.name_pt,
        'pattern', exercise.movement_pattern,
        'category', exercise.category,
        'difficulty', exercise.difficulty,
        'active', exercise.active,
        'mediaReady', private.exercise_media_is_ready(exercise.id),
        'autoPlanEligible', private.exercise_auto_plan_eligible(exercise.id, target_user_id),
        'eligibilityReasons', private.exercise_auto_plan_reasons(exercise.id, target_user_id),
        'equipment', coalesce((
          select jsonb_agg(equipment.slug order by equipment.slug)
          from public.exercise_equipment link
          join public.equipment equipment on equipment.id = link.equipment_id
          where link.exercise_id = exercise.id and link.required
        ), '[]'::jsonb)
      ) order by exercise.name_pt, exercise.id)
      from public.exercises exercise
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function public.reconcile_plan_v21(
  p_days jsonb,
  p_generator_version text,
  p_rationale jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
  admin_count integer;
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    raise exception 'Acesso restrito ao service role';
  end if;
  select count(*)::integer, min(profile.user_id::text)::uuid
  into admin_count, target_user_id
  from public.profiles profile
  where profile.role = 'admin' and profile.onboarding_completed;
  if admin_count <> 1 then
    raise exception 'Esperado um admin com onboarding completo; encontrados %', admin_count;
  end if;
  return private.create_and_activate_plan_v21(
    target_user_id, p_days, p_generator_version, p_rationale
  );
end;
$$;

revoke all on function public.get_v21_plan_reconciliation_input()
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function public.reconcile_plan_v21(jsonb, text, jsonb)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.get_v21_plan_reconciliation_input()
  to service_role;
grant execute on function public.reconcile_plan_v21(jsonb, text, jsonb)
  to service_role;

comment on view public.exercise_media_readiness is
  'Canonical v2.1 separation of catalog activation and strict media readiness.';
comment on function public.get_auto_plan_catalog() is
  'Returns the authenticated user catalog with centralized eligibility reasons.';
comment on function public.create_and_activate_plan_v21(jsonb, text, jsonb) is
  'Atomically validates, versions, and activates a v2.1 plan without deleting history.';

commit;
