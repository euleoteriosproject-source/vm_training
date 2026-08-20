-- VM Training v1.4: draft-first plans and server-side activation readiness.

create or replace function public.get_plan_readiness(p_plan_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
  with planned as (
    select distinct item.exercise_id
    from public.workout_plans plan
    join public.workout_days day on day.workout_plan_id=plan.id
    join public.workout_day_exercises item on item.workout_day_id=day.id
    where plan.id=p_plan_id and plan.user_id=auth.uid()
  ), readiness as (
    select planned.exercise_id, exercise.name_pt, exercise.active,
      public.exercise_has_approved_primary(planned.exercise_id) as has_primary
    from planned join public.exercises exercise on exercise.id=planned.exercise_id
  )
  select jsonb_build_object(
    'totalExercises', count(*),
    'primaryApproved', count(*) filter(where has_primary),
    'activeExercises', count(*) filter(where active),
    'planCoverage', case when count(*)=0 then 0 else round(100.0 * count(*) filter(where has_primary) / count(*),1) end,
    'isReady', count(*) > 0 and bool_and(has_primary and active),
    'blockers', coalesce(jsonb_agg(jsonb_build_object(
      'exerciseId',exercise_id,'name',name_pt,'missingPrimary',not has_primary,'inactive',not active
    ) order by name_pt) filter(where not has_primary or not active),'[]'::jsonb)
  ) from readiness;
$$;

create or replace function public.enforce_plan_activation() returns trigger
language plpgsql security definer set search_path='' as $$
declare total_count integer; ready_count integer;
begin
  if new.status='active' and (tg_op='INSERT' or old.status is distinct from 'active') then
    select count(distinct item.exercise_id),
      count(distinct item.exercise_id) filter(
        where exercise.active and public.exercise_has_approved_primary(item.exercise_id)
      ) into total_count,ready_count
    from public.workout_days day
    join public.workout_day_exercises item on item.workout_day_id=day.id
    join public.exercises exercise on exercise.id=item.exercise_id
    where day.workout_plan_id=new.id;
    if total_count=0 or ready_count<>total_count then
      raise exception 'Plano bloqueado: todos os exercícios precisam estar ativos e possuir PRIMARY_DEMO aprovada (%/% prontos)',ready_count,total_count;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_plan_activation_before_write on public.workout_plans;
create trigger enforce_plan_activation_before_write
before insert or update of status on public.workout_plans
for each row execute function public.enforce_plan_activation();

create or replace function public.activate_plan(p_plan_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.workout_plans where id=p_plan_id and user_id=auth.uid()) then
    raise exception 'Plano não encontrado';
  end if;
  update public.workout_plans set status='archived',archived_at=now()
    where user_id=auth.uid() and status='active' and id<>p_plan_id;
  update public.workout_plans set status='active',activated_at=now(),archived_at=null
    where id=p_plan_id and user_id=auth.uid();
end;
$$;

create or replace function public.start_workout(p_workout_day_id uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare new_session uuid; owning_plan uuid;
begin
  select plan.id into owning_plan
  from public.workout_days day
  join public.workout_plans plan on plan.id=day.workout_plan_id
  where day.id=p_workout_day_id and plan.user_id=auth.uid() and plan.status='active';
  if owning_plan is null then raise exception 'Treino ativo não encontrado'; end if;
  insert into public.workout_sessions(user_id,workout_day_id,workout_plan_id)
    values(auth.uid(),p_workout_day_id,owning_plan) returning id into new_session;
  insert into public.workout_session_exercises(workout_session_id,planned_exercise_id,actual_exercise_id,position)
    select new_session,item.exercise_id,item.exercise_id,item.position
    from public.workout_day_exercises item where item.workout_day_id=p_workout_day_id order by item.position;
  insert into public.set_logs(user_id,session_exercise_id,set_number)
    select auth.uid(),session_exercise.id,n
    from public.workout_session_exercises session_exercise
    join public.workout_day_exercises planned
      on planned.workout_day_id=p_workout_day_id
      and planned.exercise_id=session_exercise.planned_exercise_id
      and planned.position=session_exercise.position
    cross join lateral generate_series(1,planned.target_sets) n
    where session_exercise.workout_session_id=new_session;
  return new_session;
end;
$$;

create or replace function public.get_exercise_publish_readiness(p_exercise_id uuid) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object(
    'hasApprovedPrimaryMedia', public.exercise_has_approved_primary(exercise.id),
    'hasInstructions', coalesce(cardinality(exercise.execution_instructions),0) > 0,
    'hasEquipment', exists(select 1 from public.exercise_equipment link where link.exercise_id=exercise.id),
    'hasMovementPattern', nullif(btrim(exercise.movement_pattern),'') is not null,
    'hasPrimaryMuscles', coalesce(cardinality(exercise.primary_muscles),0) > 0,
    'isActive', exercise.active,
    'isReady', public.exercise_has_approved_primary(exercise.id)
      and coalesce(cardinality(exercise.execution_instructions),0) > 0
      and exists(select 1 from public.exercise_equipment link where link.exercise_id=exercise.id)
      and nullif(btrim(exercise.movement_pattern),'') is not null
      and coalesce(cardinality(exercise.primary_muscles),0) > 0
  ) from public.exercises exercise where exercise.id=p_exercise_id;
$$;

grant execute on function public.get_plan_readiness(uuid) to authenticated;
grant execute on function public.activate_plan(uuid) to authenticated;
grant execute on function public.start_workout(uuid) to authenticated;
