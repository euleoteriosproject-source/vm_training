-- Disambiguate the selected goal variable from public.user_goals.goal_code.
create or replace function public.complete_onboarding(payload jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare
  current_user_id uuid := auth.uid();
  selected_goal_code text := nullif(btrim(payload->>'goalCode'),'');
  selected_category text := nullif(btrim(payload->>'gymCategory'),'');
  attention_region text;
  mapped_location text;
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  if selected_category not in (
    'academia_essencial','academia_padrao','academia_completa','peso_livre_funcional'
  ) then raise exception 'Categoria de academia inválida'; end if;
  if selected_goal_code is null then raise exception 'Selecione um objetivo principal'; end if;

  mapped_location := case selected_category
    when 'academia_essencial' then 'small_gym'
    when 'academia_padrao' then 'full_gym'
    when 'academia_completa' then 'full_gym'
    else 'other'
  end;

  update public.profiles set
    display_name=trim(payload->>'displayName'),
    birth_date=(payload->>'birthDate')::date,
    height_cm=(payload->>'heightCm')::numeric
  where user_id=current_user_id;
  if not found then raise exception 'Perfil não encontrado'; end if;

  insert into public.body_measurements(user_id,measured_at,weight_kg,source)
  values(current_user_id,now(),(payload->>'weightKg')::numeric,'onboarding')
  on conflict(user_id) where source='onboarding' do update set
    measured_at=excluded.measured_at,
    weight_kg=excluded.weight_kg,
    updated_at=now();

  insert into public.training_preferences(
    user_id,sessions_per_week,session_minutes,cardio_preference,
    machine_preference,technical_preference,variety_preference,
    experience,training_location,gym_category,equipment_preset_version
  ) values(
    current_user_id,(payload->>'sessionsPerWeek')::smallint,
    (payload->>'sessionMinutes')::smallint,3,
    'none','simple','repeat',payload->>'experience',mapped_location,
    selected_category,1
  ) on conflict(user_id) do update set
    sessions_per_week=excluded.sessions_per_week,
    session_minutes=excluded.session_minutes,
    cardio_preference=excluded.cardio_preference,
    machine_preference=excluded.machine_preference,
    technical_preference=excluded.technical_preference,
    variety_preference=excluded.variety_preference,
    experience=excluded.experience,
    training_location=excluded.training_location,
    gym_category=excluded.gym_category,
    equipment_preset_version=excluded.equipment_preset_version;

  update public.user_goals set active=false where user_id=current_user_id;
  insert into public.user_goals(user_id,goal_code,priority,active)
  values(current_user_id,selected_goal_code,1,true)
  on conflict(user_id,goal_code) do update set priority=1,active=true;

  delete from public.user_equipment
  where user_id=current_user_id and source='preset';
  insert into public.user_equipment(user_id,equipment_id,available,source)
  select current_user_id,preset.equipment_id,true,'preset'
  from public.gym_equipment_presets preset
  where preset.gym_category=selected_category
    and preset.preset_version=1
    and preset.available_by_default
  on conflict(user_id,equipment_id) do nothing;

  delete from public.user_movement_attention where user_id=current_user_id;
  for attention_region in
    select jsonb_array_elements_text(coalesce(payload->'movementAttention','[]'::jsonb))
  loop
    if attention_region not in ('knee','shoulder','lower_back','hip','ankle','wrist','other') then
      raise exception 'Região de atenção inválida';
    end if;
    insert into public.user_movement_attention(user_id,region)
    values(current_user_id,attention_region) on conflict do nothing;
  end loop;

  update public.profiles set onboarding_completed=true where user_id=current_user_id;
end;
$$;

revoke all on function public.complete_onboarding(jsonb)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.complete_onboarding(jsonb) to authenticated;
