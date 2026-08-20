create or replace function public.complete_onboarding(payload jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare goal jsonb; equipment_id_text text;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  update public.profiles set
    display_name = trim(payload->>'displayName'), birth_date = (payload->>'birthDate')::date,
    height_cm = (payload->>'heightCm')::numeric, onboarding_completed = true
  where user_id = auth.uid();
  insert into public.body_measurements(user_id,measured_at,weight_kg)
  values(auth.uid(),now(),(payload->>'weightKg')::numeric);
  insert into public.training_preferences(user_id,sessions_per_week,session_minutes,cardio_preference,experience,training_location)
  values(auth.uid(),(payload->>'sessionsPerWeek')::smallint,(payload->>'sessionMinutes')::smallint,(payload->>'cardioPreference')::smallint,payload->>'experience',payload->>'trainingLocation')
  on conflict(user_id) do update set sessions_per_week=excluded.sessions_per_week,session_minutes=excluded.session_minutes,cardio_preference=excluded.cardio_preference,experience=excluded.experience,training_location=excluded.training_location;
  update public.user_goals set active=false where user_id=auth.uid();
  for goal in select value from jsonb_array_elements(payload->'goals') loop
    insert into public.user_goals(user_id,goal_code,priority,active) values(auth.uid(),goal->>'code',(goal->>'priority')::smallint,true)
    on conflict(user_id,goal_code) do update set priority=excluded.priority,active=true;
  end loop;
  delete from public.user_equipment where user_id=auth.uid();
  for equipment_id_text in select jsonb_array_elements_text(payload->'equipmentIds') loop
    insert into public.user_equipment(user_id,equipment_id) values(auth.uid(),equipment_id_text::uuid);
  end loop;
end;
$$;

create or replace function public.activate_plan(p_plan_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists(select 1 from public.workout_plans where id=p_plan_id and user_id=auth.uid()) then raise exception 'Plano não encontrado'; end if;
  update public.workout_plans set status='archived',archived_at=now() where user_id=auth.uid() and status='active';
  update public.workout_plans set status='active',activated_at=now() where id=p_plan_id;
end;
$$;

create or replace function public.finish_workout(p_session_id uuid, p_notes text default null) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  update public.workout_sessions set status='completed',completed_at=now(),duration_seconds=extract(epoch from (now()-started_at))::integer,notes=p_notes
  where id=p_session_id and user_id=auth.uid() and status='in_progress';
  if not found then raise exception 'Sessão não encontrada ou já encerrada'; end if;
end;
$$;

create or replace function public.delete_own_account_data() returns void
language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.profiles where user_id=auth.uid();
end;
$$;
