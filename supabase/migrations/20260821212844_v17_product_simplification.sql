-- VM Training v1.7: product simplification, gym presets and media-independent workouts.

alter table public.training_preferences
  add column if not exists gym_category text,
  add column if not exists equipment_preset_version integer not null default 1;

update public.training_preferences
set gym_category = case training_location
  when 'small_gym' then 'academia_essencial'
  when 'condo' then 'academia_essencial'
  when 'home' then 'peso_livre_funcional'
  when 'other' then 'peso_livre_funcional'
  else 'academia_padrao'
end
where gym_category is null;

alter table public.training_preferences
  alter column gym_category set default 'academia_padrao',
  alter column gym_category set not null,
  alter column machine_preference set default 'none',
  alter column technical_preference set default 'simple',
  alter column variety_preference set default 'repeat';

alter table public.training_preferences
  drop constraint if exists training_preferences_gym_category_check;
alter table public.training_preferences
  add constraint training_preferences_gym_category_check
  check(gym_category in (
    'academia_essencial','academia_padrao','academia_completa','peso_livre_funcional'
  ));

alter table public.user_equipment
  add column if not exists source text not null default 'user_override';
alter table public.user_equipment
  drop constraint if exists user_equipment_source_check;
alter table public.user_equipment
  add constraint user_equipment_source_check
  check(source in ('preset','user_override'));

alter table public.body_measurements
  add column if not exists source text not null default 'manual';
alter table public.body_measurements
  drop constraint if exists body_measurements_source_check;
alter table public.body_measurements
  add constraint body_measurements_source_check
  check(source in ('manual','onboarding'));
create unique index if not exists body_measurements_one_onboarding_per_user
  on public.body_measurements(user_id) where source='onboarding';

create table public.gym_equipment_presets (
  gym_category text not null check(gym_category in (
    'academia_essencial','academia_padrao','academia_completa','peso_livre_funcional'
  )),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  available_by_default boolean not null default true,
  confidence numeric(3,2) not null check(confidence between 0 and 1),
  preset_version integer not null default 1 check(preset_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(gym_category,equipment_id,preset_version)
);

alter table public.gym_equipment_presets enable row level security;
create policy "authenticated reads gym presets"
  on public.gym_equipment_presets for select to authenticated using(true);
revoke all privileges on table public.gym_equipment_presets
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant select on table public.gym_equipment_presets to authenticated;
grant select,insert,update,delete on table public.gym_equipment_presets to service_role;

create trigger set_gym_equipment_presets_updated_at
before update on public.gym_equipment_presets
for each row execute function public.set_updated_at();

insert into public.gym_equipment_presets(
  gym_category,equipment_id,available_by_default,confidence,preset_version
)
select preset.gym_category,equipment.id,true,preset.confidence,1
from (
  values
    ('academia_essencial','treadmill',0.90::numeric),
    ('academia_essencial','bike',0.85::numeric),
    ('academia_essencial','elliptical',0.65::numeric),
    ('academia_essencial','dumbbells',0.95::numeric),
    ('academia_essencial','bench',0.85::numeric),
    ('academia_essencial','cable',0.65::numeric),
    ('academia_essencial','band',0.70::numeric),
    ('academia_essencial','bodyweight',1.00::numeric),
    ('academia_padrao','treadmill',0.98::numeric),
    ('academia_padrao','bike',0.95::numeric),
    ('academia_padrao','elliptical',0.85::numeric),
    ('academia_padrao','dumbbells',0.99::numeric),
    ('academia_padrao','bench',0.98::numeric),
    ('academia_padrao','cable',0.95::numeric),
    ('academia_padrao','band',0.75::numeric),
    ('academia_padrao','bodyweight',1.00::numeric),
    ('academia_padrao','leg-press',0.95::numeric),
    ('academia_padrao','leg-extension',0.95::numeric),
    ('academia_padrao','lying-leg-curl',0.80::numeric),
    ('academia_padrao','seated-leg-curl',0.80::numeric),
    ('academia_padrao','lat-pulldown',0.95::numeric),
    ('academia_padrao','row-machine',0.85::numeric),
    ('academia_padrao','chest-press',0.90::numeric),
    ('academia_padrao','smith',0.80::numeric),
    ('academia_padrao','barbell',0.90::numeric),
    ('academia_padrao','kettlebell',0.70::numeric),
    ('academia_completa','treadmill',0.99::numeric),
    ('academia_completa','bike',0.99::numeric),
    ('academia_completa','elliptical',0.95::numeric),
    ('academia_completa','dumbbells',1.00::numeric),
    ('academia_completa','bench',1.00::numeric),
    ('academia_completa','cable',0.99::numeric),
    ('academia_completa','band',0.85::numeric),
    ('academia_completa','bodyweight',1.00::numeric),
    ('academia_completa','leg-press',0.99::numeric),
    ('academia_completa','hack-squat',0.90::numeric),
    ('academia_completa','smith',0.95::numeric),
    ('academia_completa','leg-extension',0.99::numeric),
    ('academia_completa','lying-leg-curl',0.95::numeric),
    ('academia_completa','seated-leg-curl',0.95::numeric),
    ('academia_completa','abductor',0.90::numeric),
    ('academia_completa','adductor',0.90::numeric),
    ('academia_completa','row-machine',0.95::numeric),
    ('academia_completa','lat-pulldown',0.99::numeric),
    ('academia_completa','chest-press',0.98::numeric),
    ('academia_completa','barbell',0.98::numeric),
    ('academia_completa','kettlebell',0.90::numeric),
    ('peso_livre_funcional','bodyweight',1.00::numeric),
    ('peso_livre_funcional','barbell',0.95::numeric),
    ('peso_livre_funcional','bench',0.90::numeric),
    ('peso_livre_funcional','dumbbells',0.98::numeric),
    ('peso_livre_funcional','kettlebell',0.95::numeric),
    ('peso_livre_funcional','band',0.90::numeric),
    ('peso_livre_funcional','cable',0.55::numeric)
) as preset(gym_category,equipment_slug,confidence)
join public.equipment equipment on equipment.slug=preset.equipment_slug
on conflict do nothing;

create table public.user_movement_attention (
  user_id uuid not null references auth.users(id) on delete cascade,
  region text not null check(region in (
    'knee','shoulder','lower_back','hip','ankle','wrist','other'
  )),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_id,region)
);

alter table public.user_movement_attention enable row level security;
create policy "own movement attention select"
  on public.user_movement_attention for select to authenticated
  using((select auth.uid())=user_id);
create policy "own movement attention insert"
  on public.user_movement_attention for insert to authenticated
  with check((select auth.uid())=user_id);
create policy "own movement attention update"
  on public.user_movement_attention for update to authenticated
  using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy "own movement attention delete"
  on public.user_movement_attention for delete to authenticated
  using((select auth.uid())=user_id);
revoke all privileges on table public.user_movement_attention
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant select,insert,update,delete on table public.user_movement_attention to authenticated;
grant select,insert,update,delete on table public.user_movement_attention to service_role;
create trigger set_user_movement_attention_updated_at
before update on public.user_movement_attention
for each row execute function public.set_updated_at();

create table public.workout_substitution_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_exercise_id uuid not null references public.workout_session_exercises(id) on delete cascade,
  from_exercise_id uuid not null references public.exercises(id) on delete restrict,
  to_exercise_id uuid not null references public.exercises(id) on delete restrict,
  reason text not null check(reason in ('equipment_unavailable','temporarily_unavailable','user_requested')),
  equipment_id uuid references public.equipment(id) on delete set null,
  equipment_had_row boolean not null default false,
  equipment_previous_available boolean,
  equipment_previous_source text,
  undone_at timestamptz,
  created_at timestamptz not null default now()
);
create index workout_substitution_events_user_created_idx
  on public.workout_substitution_events(user_id,created_at desc);
alter table public.workout_substitution_events enable row level security;
create policy "own substitution events read"
  on public.workout_substitution_events for select to authenticated
  using((select auth.uid())=user_id);
revoke all privileges on table public.workout_substitution_events
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant select on table public.workout_substitution_events to authenticated;
grant select,insert,update,delete on table public.workout_substitution_events to service_role;

create or replace function public.complete_onboarding(payload jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare
  current_user_id uuid := auth.uid();
  goal_code text := nullif(btrim(payload->>'goalCode'),'');
  selected_category text := nullif(btrim(payload->>'gymCategory'),'');
  attention_region text;
  mapped_location text;
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  if selected_category not in (
    'academia_essencial','academia_padrao','academia_completa','peso_livre_funcional'
  ) then raise exception 'Categoria de academia inválida'; end if;
  if goal_code is null then raise exception 'Selecione um objetivo principal'; end if;

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
  values(current_user_id,goal_code,1,true)
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

create or replace function public.get_plan_readiness(p_plan_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
  with selected_plan as (
    select plan.id
    from public.workout_plans plan
    where plan.id=p_plan_id and plan.user_id=auth.uid()
  ), plan_days as (
    select day.id,day.estimated_minutes
    from public.workout_days day join selected_plan plan on plan.id=day.workout_plan_id
  ), planned as (
    select item.id,item.exercise_id,item.target_sets,item.rep_min,item.rep_max,
      item.target_duration_seconds,item.rest_seconds,exercise.name_pt,exercise.active,
      public.exercise_has_approved_primary(item.exercise_id) as has_primary,
      (
        item.target_sets between 1 and 20
        and item.rest_seconds >= 0
        and (
          (item.rep_min is not null and item.rep_min > 0 and item.rep_max >= item.rep_min)
          or coalesce(item.target_duration_seconds,0) > 0
        )
      ) as valid_structure
    from public.workout_day_exercises item
    join plan_days day on day.id=item.workout_day_id
    join public.exercises exercise on exercise.id=item.exercise_id
  )
  select jsonb_build_object(
    'totalDays',(select count(*) from plan_days),
    'totalExercises',(select count(*) from planned),
    'activeExercises',(select count(*) from planned where active),
    'primaryApproved',(select count(*) from planned where has_primary),
    'mediaCoverage',case when (select count(*) from planned)=0 then 0 else
      round(100.0*(select count(*) from planned where has_primary)/(select count(*) from planned),1) end,
    'validStructure',coalesce((select bool_and(valid_structure) from planned),false),
    'isReady',
      (select count(*) from plan_days)>0
      and (select count(*) from planned)>0
      and coalesce((select bool_and(active and valid_structure) from planned),false),
    'blockers',coalesce((
      select jsonb_agg(jsonb_build_object(
        'exerciseId',exercise_id,'name',name_pt,'inactive',not active,
        'invalidStructure',not valid_structure,'missingPrimary',not has_primary
      ) order by name_pt)
      from planned where not active or not valid_structure
    ),'[]'::jsonb)
  );
$$;

create or replace function public.enforce_plan_activation() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  day_count integer;
  item_count integer;
  invalid_count integer;
begin
  if new.status='active'
     and (tg_op='INSERT' or (tg_op='UPDATE' and old.status is distinct from 'active')) then
    select count(*) into day_count
    from public.workout_days day where day.workout_plan_id=new.id;
    select count(*),count(*) filter(where
      not exercise.active
      or item.target_sets not between 1 and 20
      or item.rest_seconds < 0
      or not (
        (item.rep_min is not null and item.rep_min > 0 and item.rep_max >= item.rep_min)
        or coalesce(item.target_duration_seconds,0)>0
      )
    ) into item_count,invalid_count
    from public.workout_days day
    join public.workout_day_exercises item on item.workout_day_id=day.id
    join public.exercises exercise on exercise.id=item.exercise_id
    where day.workout_plan_id=new.id;
    if day_count=0 or item_count=0 or invalid_count>0 then
      raise exception 'Plano bloqueado: estrutura inválida ou exercício indisponível';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.get_exercise_publish_readiness(p_exercise_id uuid) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object(
    'hasApprovedPrimaryMedia',public.exercise_has_approved_primary(exercise.id),
    'mediaReady',public.exercise_has_approved_primary(exercise.id),
    'hasInstructions',coalesce(cardinality(exercise.execution_instructions),0)>0,
    'hasEquipment',exists(select 1 from public.exercise_equipment link where link.exercise_id=exercise.id),
    'hasMovementPattern',nullif(btrim(exercise.movement_pattern),'') is not null,
    'hasPrimaryMuscles',coalesce(cardinality(exercise.primary_muscles),0)>0,
    'isActive',exercise.active,
    'catalogReady',
      nullif(btrim(exercise.name_pt),'') is not null
      and coalesce(cardinality(exercise.execution_instructions),0)>0
      and exists(select 1 from public.exercise_equipment link where link.exercise_id=exercise.id)
      and nullif(btrim(exercise.movement_pattern),'') is not null
      and coalesce(cardinality(exercise.primary_muscles),0)>0,
    'isReady',
      nullif(btrim(exercise.name_pt),'') is not null
      and coalesce(cardinality(exercise.execution_instructions),0)>0
      and exists(select 1 from public.exercise_equipment link where link.exercise_id=exercise.id)
      and nullif(btrim(exercise.movement_pattern),'') is not null
      and coalesce(cardinality(exercise.primary_muscles),0)>0
  ) from public.exercises exercise where exercise.id=p_exercise_id;
$$;

drop trigger if exists exercise_requires_media on public.exercises;
create or replace function public.enforce_exercise_media() returns trigger
language plpgsql set search_path='' as $$
begin
  return new;
end;
$$;

create or replace function public.prevent_primary_media_regression() returns trigger
language plpgsql set search_path='' as $$
begin
  -- Raw client writes are already denied by table grants and RLS. Publication and
  -- demotion happen atomically through the service-role-only RPC below.
  return new;
end;
$$;

create or replace function public.publish_exercise_media(p_media_id uuid,p_admin_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  candidate public.exercise_media%rowtype;
begin
  if not exists(
    select 1 from public.profiles profile
    where profile.user_id=p_admin_id and profile.role='admin'
  ) then raise exception 'Apenas administradores podem publicar mídia'; end if;

  select * into candidate from public.exercise_media media
  where media.id=p_media_id for update;
  if not found then raise exception 'Mídia não encontrada'; end if;
  if candidate.status<>'processed' then
    raise exception 'Somente mídia processada pode ser publicada';
  end if;
  if candidate.media_role is null then raise exception 'Classifique a mídia antes de publicar'; end if;

  if candidate.media_role='PRIMARY_DEMO' then
    update public.exercise_media set
      status='reviewing',is_primary=false,updated_at=now()
    where exercise_id=candidate.exercise_id and id<>candidate.id
      and status='approved' and media_role='PRIMARY_DEMO' and is_primary=true;
  end if;

  update public.exercise_media set
    status='approved',execution_quality='approved',
    is_primary=(media_role='PRIMARY_DEMO'),approved_by=p_admin_id,
    approved_at=now(),processing_error=null,updated_at=now()
  where id=candidate.id;

  insert into public.media_review_events(
    media_id,admin_user_id,action,from_status,to_status
  ) values(candidate.id,p_admin_id,'approved','processed','approved');

  return public.get_exercise_publish_readiness(candidate.exercise_id);
end;
$$;

create or replace function public.substitute_workout_exercise(
  p_session_exercise_id uuid,
  p_reason text,
  p_equipment_id uuid default null,
  p_exclude_exercise_ids uuid[] default '{}'::uuid[]
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  current_user_id uuid := auth.uid();
  current_exercise_id uuid;
  replacement_id uuid;
  replacement_name text;
  event_id uuid;
  previous_equipment public.user_equipment%rowtype;
  equipment_had_row boolean := false;
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  if p_reason not in ('equipment_unavailable','temporarily_unavailable','user_requested') then
    raise exception 'Motivo de substituição inválido';
  end if;

  select session_exercise.actual_exercise_id into current_exercise_id
  from public.workout_session_exercises session_exercise
  join public.workout_sessions session on session.id=session_exercise.workout_session_id
  where session_exercise.id=p_session_exercise_id
    and session.user_id=current_user_id and session.status='in_progress'
  for update of session_exercise;
  if current_exercise_id is null then raise exception 'Exercício da sessão não encontrado'; end if;

  if p_reason='equipment_unavailable' and p_equipment_id is not null then
    select * into previous_equipment from public.user_equipment
    where user_id=current_user_id and equipment_id=p_equipment_id;
    equipment_had_row := found;
    insert into public.user_equipment(user_id,equipment_id,available,source,temporary_unavailable_until)
    values(current_user_id,p_equipment_id,false,'user_override',null)
    on conflict(user_id,equipment_id) do update set
      available=false,source='user_override',temporary_unavailable_until=null,updated_at=now();
  end if;

  with source_exercise as (
    select * from public.exercises where id=current_exercise_id
  ), candidates as (
    select candidate.id,candidate.name_pt,
      coalesce(explicit.score,0)
      + case when candidate.movement_pattern=source.movement_pattern then 45 else 0 end
      + case when candidate.primary_muscles && source.primary_muscles then 30 else 0 end
      + case when candidate.difficulty=source.difficulty then 10 else 0 end
      - case
          when exists(select 1 from public.user_movement_attention attention
            where attention.user_id=current_user_id and attention.active
              and ((attention.region='knee' and candidate.movement_pattern in ('squat','knee_extension','knee_flexion'))
                or (attention.region='shoulder' and candidate.movement_pattern in ('horizontal_push','vertical_push'))
                or (attention.region='lower_back' and candidate.movement_pattern in ('hinge','core_flexion'))
                or (attention.region='hip' and candidate.movement_pattern in ('squat','hinge','hip_extension'))))
          then 25 else 0 end as rank_score
    from source_exercise source
    join public.exercises candidate on candidate.active and candidate.id<>source.id
    left join public.exercise_substitutions explicit
      on explicit.exercise_id=source.id and explicit.alternative_exercise_id=candidate.id
    where not(candidate.id=any(coalesce(p_exclude_exercise_ids,'{}'::uuid[])))
      and not exists(
        select 1 from public.exercise_equipment required_link
        join public.equipment equipment on equipment.id=required_link.equipment_id
        where required_link.exercise_id=candidate.id and required_link.required
          and equipment.slug<>'bodyweight'
          and not exists(
            select 1 from public.user_equipment available_equipment
            where available_equipment.user_id=current_user_id
              and available_equipment.equipment_id=required_link.equipment_id
              and available_equipment.available
              and (available_equipment.temporary_unavailable_until is null
                or available_equipment.temporary_unavailable_until<=now())
          )
      )
  )
  select id,name_pt into replacement_id,replacement_name
  from candidates order by rank_score desc,name_pt limit 1;

  if replacement_id is null then raise exception 'Nenhuma substituição compatível disponível'; end if;

  update public.workout_session_exercises set
    actual_exercise_id=replacement_id,substitution_reason=p_reason,updated_at=now()
  where id=p_session_exercise_id;

  insert into public.workout_substitution_events(
    user_id,session_exercise_id,from_exercise_id,to_exercise_id,reason,equipment_id,
    equipment_had_row,equipment_previous_available,equipment_previous_source
  ) values(
    current_user_id,p_session_exercise_id,current_exercise_id,replacement_id,p_reason,p_equipment_id,
    equipment_had_row,previous_equipment.available,previous_equipment.source
  ) returning id into event_id;

  return jsonb_build_object(
    'eventId',event_id,'exerciseId',replacement_id,'exerciseName',replacement_name
  );
end;
$$;

create or replace function public.undo_workout_substitution(p_event_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  current_user_id uuid := auth.uid();
  event public.workout_substitution_events%rowtype;
  restored_name text;
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  select * into event from public.workout_substitution_events
  where id=p_event_id and user_id=current_user_id and undone_at is null for update;
  if not found then raise exception 'Substituição não encontrada ou já desfeita'; end if;

  update public.workout_session_exercises set
    actual_exercise_id=event.from_exercise_id,substitution_reason=null,updated_at=now()
  where id=event.session_exercise_id;

  if event.reason='equipment_unavailable' and event.equipment_id is not null then
    if event.equipment_had_row then
      update public.user_equipment set
        available=event.equipment_previous_available,
        source=event.equipment_previous_source,
        updated_at=now()
      where user_id=current_user_id and equipment_id=event.equipment_id;
    else
      delete from public.user_equipment
      where user_id=current_user_id and equipment_id=event.equipment_id;
    end if;
  end if;

  update public.workout_substitution_events set undone_at=now() where id=p_event_id;
  select name_pt into restored_name from public.exercises where id=event.from_exercise_id;
  return jsonb_build_object('exerciseId',event.from_exercise_id,'exerciseName',restored_name);
end;
$$;

-- Catalog readiness is independent from media readiness.
update public.exercises exercise set active=true
where nullif(btrim(exercise.name_pt),'') is not null
  and coalesce(cardinality(exercise.execution_instructions),0)>0
  and nullif(btrim(exercise.movement_pattern),'') is not null
  and coalesce(cardinality(exercise.primary_muscles),0)>0
  and exists(select 1 from public.exercise_equipment link where link.exercise_id=exercise.id);

-- Preserve and activate only the newest structurally valid draft per user when
-- no active plan exists. This keeps the partial unique active-plan index safe.
with valid_drafts as (
  select plan.id,
    row_number() over(partition by plan.user_id order by plan.created_at desc,plan.id desc) as draft_rank
  from public.workout_plans plan
  where plan.status='draft'
    and not exists(
      select 1 from public.workout_plans active_plan
      where active_plan.user_id=plan.user_id and active_plan.status='active'
    )
    and exists(select 1 from public.workout_days day where day.workout_plan_id=plan.id)
    and exists(
      select 1 from public.workout_days day
      join public.workout_day_exercises item on item.workout_day_id=day.id
      where day.workout_plan_id=plan.id
    )
    and not exists(
      select 1 from public.workout_days day
      join public.workout_day_exercises item on item.workout_day_id=day.id
      join public.exercises exercise on exercise.id=item.exercise_id
      where day.workout_plan_id=plan.id and (
        not exercise.active or item.target_sets not between 1 and 20 or item.rest_seconds<0
        or not ((item.rep_min is not null and item.rep_min>0 and item.rep_max>=item.rep_min)
          or coalesce(item.target_duration_seconds,0)>0)
      )
    )
)
update public.workout_plans plan set
  status='active',activated_at=coalesce(activated_at,now()),archived_at=null
from valid_drafts candidate
where plan.id=candidate.id and candidate.draft_rank=1;

revoke all on function public.complete_onboarding(jsonb)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.complete_onboarding(jsonb) to authenticated;

revoke all on function public.get_plan_readiness(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.get_plan_readiness(uuid) to authenticated,service_role;

revoke all on function public.get_exercise_publish_readiness(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.get_exercise_publish_readiness(uuid) to authenticated,service_role;

revoke all on function public.enforce_exercise_media()
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function public.enforce_plan_activation()
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function public.prevent_primary_media_regression()
  from public, anon, authenticated, service_role, supabase_auth_admin;

revoke all on function public.publish_exercise_media(uuid,uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.publish_exercise_media(uuid,uuid) to service_role;

revoke all on function public.substitute_workout_exercise(uuid,text,uuid,uuid[])
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.substitute_workout_exercise(uuid,text,uuid,uuid[]) to authenticated;

revoke all on function public.undo_workout_substitution(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.undo_workout_substitution(uuid) to authenticated;
