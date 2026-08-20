-- Persist optional exercise preferences collected during v1.4 onboarding.
create or replace function public.complete_onboarding(payload jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare goal jsonb; preference jsonb; equipment_id_text text;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  update public.profiles set
    display_name=trim(payload->>'displayName'),
    birth_date=(payload->>'birthDate')::date,
    height_cm=(payload->>'heightCm')::numeric,
    onboarding_completed=true
  where user_id=auth.uid();
  insert into public.body_measurements(user_id,measured_at,weight_kg)
  values(auth.uid(),now(),(payload->>'weightKg')::numeric);
  insert into public.training_preferences(
    user_id,sessions_per_week,session_minutes,cardio_preference,experience,training_location
  ) values(
    auth.uid(),(payload->>'sessionsPerWeek')::smallint,
    (payload->>'sessionMinutes')::smallint,(payload->>'cardioPreference')::smallint,
    payload->>'experience',payload->>'trainingLocation'
  ) on conflict(user_id) do update set
    sessions_per_week=excluded.sessions_per_week,
    session_minutes=excluded.session_minutes,
    cardio_preference=excluded.cardio_preference,
    experience=excluded.experience,
    training_location=excluded.training_location;
  update public.user_goals set active=false where user_id=auth.uid();
  for goal in select value from jsonb_array_elements(payload->'goals') loop
    insert into public.user_goals(user_id,goal_code,priority,active)
    values(auth.uid(),goal->>'code',(goal->>'priority')::smallint,true)
    on conflict(user_id,goal_code) do update set priority=excluded.priority,active=true;
  end loop;
  delete from public.user_equipment where user_id=auth.uid();
  for equipment_id_text in select jsonb_array_elements_text(payload->'equipmentIds') loop
    insert into public.user_equipment(user_id,equipment_id)
    values(auth.uid(),equipment_id_text::uuid);
  end loop;
  delete from public.user_exercise_preferences where user_id=auth.uid();
  for preference in select value from jsonb_array_elements(coalesce(payload->'exercisePreferences','[]'::jsonb)) loop
    insert into public.user_exercise_preferences(user_id,exercise_id,preference)
    values(auth.uid(),(preference->>'exerciseId')::uuid,preference->>'preference');
  end loop;
end;
$$;

grant execute on function public.complete_onboarding(jsonb) to authenticated;
