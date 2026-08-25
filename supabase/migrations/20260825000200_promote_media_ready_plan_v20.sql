-- Least-privilege service operations for the one-time v2.0 plan reconciliation.
-- Personal training tables remain unavailable to service_role. The read RPC
-- exposes only generation inputs, and the write RPC validates and promotes the
-- complete replacement in one transaction.

create or replace function public.get_v20_plan_reconciliation_input()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
  admin_count integer;
  result jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Acesso restrito ao service role';
  end if;
  select count(*)::integer, min(profile.user_id::text)::uuid
  into admin_count, target_user_id
  from public.profiles profile
  where profile.role = 'admin' and profile.onboarding_completed;
  if admin_count <> 1 then
    raise exception 'Esperado um admin com onboarding completo; encontrados %', admin_count;
  end if;
  if not exists (
    select 1 from public.training_preferences preference
    where preference.user_id = target_user_id
  ) then
    raise exception 'Preferências de treino ausentes para o admin';
  end if;

  select jsonb_build_object(
    'userId', target_user_id,
    'preferences', (
      select jsonb_build_object(
        'sessionsPerWeek', preference.sessions_per_week,
        'sessionMinutes', preference.session_minutes,
        'cardioPreference', preference.cardio_preference,
        'experience', preference.experience
      )
      from public.training_preferences preference
      where preference.user_id = target_user_id
    ),
    'goals', coalesce((
      select jsonb_agg(
        jsonb_build_object('code', goal.goal_code, 'priority', goal.priority)
        order by goal.priority, goal.goal_code
      )
      from public.user_goals goal
      where goal.user_id = target_user_id and goal.active
    ), '[]'::jsonb),
    'equipment', coalesce((
      select jsonb_agg(equipment.slug order by equipment.slug)
      from public.user_equipment user_equipment
      join public.equipment equipment on equipment.id = user_equipment.equipment_id
      where user_equipment.user_id = target_user_id and user_equipment.available
    ), '[]'::jsonb),
    'exercisePreferences', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'exerciseId', preference.exercise_id,
          'preference', preference.preference
        ) order by preference.exercise_id
      )
      from public.user_exercise_preferences preference
      where preference.user_id = target_user_id
    ), '[]'::jsonb),
    'inProgressSessionIds', coalesce((
      select jsonb_agg(session.id order by session.started_at)
      from public.workout_sessions session
      where session.user_id = target_user_id and session.status = 'in_progress'
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function public.reconcile_media_ready_plan_v20(p_days jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
  admin_count integer;
  expected_days integer;
  requested_count integer;
  ready_count integer;
  plan_id uuid;
  day_id uuid;
  day_entry record;
  exercise_entry record;
  in_progress_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Acesso restrito ao service role';
  end if;
  if jsonb_typeof(p_days) <> 'array' then
    raise exception 'Plano v2.0 inválido';
  end if;
  select count(*)::integer, min(profile.user_id::text)::uuid
  into admin_count, target_user_id
  from public.profiles profile
  where profile.role = 'admin' and profile.onboarding_completed;
  if admin_count <> 1 then
    raise exception 'Esperado um admin com onboarding completo; encontrados %', admin_count;
  end if;
  select preference.sessions_per_week
  into strict expected_days
  from public.training_preferences preference
  where preference.user_id = target_user_id;
  if jsonb_array_length(p_days) <> expected_days then
    raise exception 'Quantidade de dias diverge das preferências';
  end if;

  with requested as (
    select distinct (exercise.value->>'exerciseId')::uuid as exercise_id
    from jsonb_array_elements(p_days) day(value)
    cross join lateral jsonb_array_elements(day.value->'exercises') exercise(value)
  )
  select count(*)::integer,
    count(*) filter (
      where catalog.active and public.exercise_has_approved_primary(catalog.id)
    )::integer
  into requested_count, ready_count
  from requested
  left join public.exercises catalog on catalog.id = requested.exercise_id;
  if requested_count < 4 or ready_count <> requested_count then
    raise exception 'Plano v2.0 contém exercício inativo ou sem PRIMARY_DEMO (%/% prontos)',
      ready_count, requested_count;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_user_id::text, 20)
  );
  insert into public.workout_plans(
    user_id, name, status, source, sessions_per_week, target_session_minutes
  )
  select target_user_id, 'Meu plano', 'draft', 'generated',
    preference.sessions_per_week, preference.session_minutes
  from public.training_preferences preference
  where preference.user_id = target_user_id
  returning id into plan_id;

  for day_entry in
    select day.value, day.ordinality
    from jsonb_array_elements(p_days) with ordinality day(value, ordinality)
    order by day.ordinality
  loop
    if jsonb_typeof(day_entry.value->'exercises') <> 'array'
       or jsonb_array_length(day_entry.value->'exercises') = 0 then
      raise exception 'Dia v2.0 sem exercícios';
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
      insert into public.workout_day_exercises(
        workout_day_id, exercise_id, position, target_sets,
        rep_min, rep_max, rest_seconds, target_duration_seconds
      ) values (
        day_id,
        (exercise_entry.value->>'exerciseId')::uuid,
        exercise_entry.ordinality,
        (exercise_entry.value->>'sets')::smallint,
        (exercise_entry.value->>'repMin')::smallint,
        (exercise_entry.value->>'repMax')::smallint,
        (exercise_entry.value->>'restSeconds')::integer,
        (exercise_entry.value->>'targetDurationSeconds')::integer
      );
    end loop;
  end loop;

  update public.workout_plans
  set status = 'archived', archived_at = now()
  where user_id = target_user_id and status = 'active' and id <> plan_id;
  update public.workout_plans
  set status = 'active', activated_at = now(), archived_at = null
  where id = plan_id and user_id = target_user_id and status = 'draft';
  if not found then raise exception 'Falha ao promover plano v2.0'; end if;

  select count(*)::integer into in_progress_count
  from public.workout_sessions session
  where session.user_id = target_user_id and session.status = 'in_progress';
  return jsonb_build_object(
    'planId', plan_id,
    'uniqueExercises', requested_count,
    'inProgressSessions', in_progress_count
  );
end;
$$;

revoke all on function public.get_v20_plan_reconciliation_input()
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function public.reconcile_media_ready_plan_v20(jsonb)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.get_v20_plan_reconciliation_input()
  to service_role;
grant execute on function public.reconcile_media_ready_plan_v20(jsonb)
  to service_role;

comment on function public.get_v20_plan_reconciliation_input() is
  'Returns the minimum non-identifying inputs for the one-time v2.0 generator run.';
comment on function public.reconcile_media_ready_plan_v20(jsonb) is
  'Validates, creates, and atomically activates a media-ready replacement plan.';
