-- VM Training v2.1.4: classify replacements as strict equivalents,
-- goal-aligned direct alternatives, or preview-only plan rebalances.

begin;

alter table public.plan_exercise_change_events
  drop constraint if exists plan_exercise_change_events_change_type_check;
alter table public.plan_exercise_change_events
  add constraint plan_exercise_change_events_change_type_check
  check (change_type in ('equivalent', 'goal_aligned', 'rebalance'));

alter table public.plan_exercise_change_events
  add column if not exists replacement_type text,
  add column if not exists reason_code text,
  add column if not exists scope text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.plan_exercise_change_events
set replacement_type = case change_type
    when 'equivalent' then 'DIRECT_EQUIVALENT'
    when 'goal_aligned' then 'GOAL_ALIGNED_ALTERNATIVE'
    else 'PLAN_REBALANCE'
  end,
  reason_code = coalesce(reason_code, 'user_choice'),
  scope = coalesce(scope, 'plan')
where replacement_type is null or reason_code is null or scope is null;

alter table public.plan_exercise_change_events
  alter column replacement_type set not null,
  alter column reason_code set not null,
  alter column scope set not null;
alter table public.plan_exercise_change_events
  add constraint plan_exercise_change_events_replacement_type_check
  check (replacement_type in (
    'DIRECT_EQUIVALENT', 'GOAL_ALIGNED_ALTERNATIVE', 'PLAN_REBALANCE'
  )),
  add constraint plan_exercise_change_events_reason_code_check
  check (reason_code in (
    'occupied_today', 'equipment_missing', 'exercise_dislike',
    'user_choice', 'other'
  )),
  add constraint plan_exercise_change_events_scope_check
  check (scope in ('session', 'plan'));

create or replace function private.normalize_plan_change_event_v214()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.replacement_type := coalesce(new.replacement_type, case new.change_type
    when 'equivalent' then 'DIRECT_EQUIVALENT'
    when 'goal_aligned' then 'GOAL_ALIGNED_ALTERNATIVE'
    else 'PLAN_REBALANCE'
  end);
  new.reason_code := coalesce(new.reason_code, 'user_choice');
  new.scope := coalesce(new.scope, 'plan');
  new.metadata := coalesce(new.metadata, '{}'::jsonb);
  return new;
end;
$$;

revoke all on function private.normalize_plan_change_event_v214()
  from public, anon, authenticated, service_role, supabase_auth_admin;

drop trigger if exists normalize_plan_change_event_v214
  on public.plan_exercise_change_events;
create trigger normalize_plan_change_event_v214
before insert or update of change_type, replacement_type, reason_code, scope, metadata
on public.plan_exercise_change_events
for each row execute function private.normalize_plan_change_event_v214();

alter table public.workout_substitution_events
  drop constraint if exists workout_substitution_events_reason_check;
alter table public.workout_substitution_events
  add constraint workout_substitution_events_reason_check
  check (reason in (
    'equipment_unavailable', 'temporarily_unavailable', 'user_requested',
    'occupied_today', 'equipment_missing', 'exercise_dislike',
    'user_choice', 'other'
  ));

alter table public.workout_substitution_events
  add column if not exists replacement_type text,
  add column if not exists reason_code text,
  add column if not exists scope text,
  add column if not exists persistent_exclusion boolean not null default false,
  add column if not exists preference_had_row boolean not null default false,
  add column if not exists preference_previous_value text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.workout_substitution_events event
set replacement_type = coalesce(event.replacement_type, case
      when private.exercises_are_semantically_equivalent_v212(
        event.from_exercise_id, event.to_exercise_id
      ) then 'DIRECT_EQUIVALENT'
      else 'GOAL_ALIGNED_ALTERNATIVE'
    end),
  reason_code = coalesce(event.reason_code, case event.reason
    when 'equipment_unavailable' then 'equipment_missing'
    when 'temporarily_unavailable' then 'occupied_today'
    when 'user_requested' then 'exercise_dislike'
    else event.reason
  end),
  scope = coalesce(event.scope, 'session')
where event.replacement_type is null or event.reason_code is null
  or event.scope is null;

alter table public.workout_substitution_events
  alter column replacement_type set not null,
  alter column reason_code set not null,
  alter column scope set not null;
alter table public.workout_substitution_events
  add constraint workout_substitution_events_replacement_type_check
  check (replacement_type in (
    'DIRECT_EQUIVALENT', 'GOAL_ALIGNED_ALTERNATIVE', 'REQUIRES_REBALANCE'
  )),
  add constraint workout_substitution_events_reason_code_check
  check (reason_code in (
    'occupied_today', 'equipment_missing', 'exercise_dislike',
    'user_choice', 'other'
  )),
  add constraint workout_substitution_events_scope_check
  check (scope = 'session');

create or replace function private.normalize_session_change_event_v214()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.replacement_type := coalesce(new.replacement_type, case
    when private.exercises_are_semantically_equivalent_v212(
      new.from_exercise_id, new.to_exercise_id
    ) then 'DIRECT_EQUIVALENT'
    else 'GOAL_ALIGNED_ALTERNATIVE'
  end);
  new.reason_code := coalesce(new.reason_code, case new.reason
    when 'equipment_unavailable' then 'equipment_missing'
    when 'temporarily_unavailable' then 'occupied_today'
    when 'user_requested' then 'exercise_dislike'
    else new.reason
  end);
  new.scope := coalesce(new.scope, 'session');
  new.metadata := coalesce(new.metadata, '{}'::jsonb);
  return new;
end;
$$;

revoke all on function private.normalize_session_change_event_v214()
  from public, anon, authenticated, service_role, supabase_auth_admin;

drop trigger if exists normalize_session_change_event_v214
  on public.workout_substitution_events;
create trigger normalize_session_change_event_v214
before insert or update of reason, replacement_type, reason_code, scope, metadata
on public.workout_substitution_events
for each row execute function private.normalize_session_change_event_v214();

create or replace function private.simulate_plan_replacement_v214(
  p_workout_day_exercise_id uuid,
  p_candidate_exercise_id uuid,
  p_user_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with selected_plan as (
    select plan.id, plan.user_id, plan.goal_code, plan.sessions_per_week,
      plan.target_session_minutes,
      nullif(plan.generation_rationale #>> '{v213RetainedAvoid,exerciseId}', '')::uuid
        as retained_avoid_exercise_id
    from public.workout_day_exercises selected_slot
    join public.workout_days selected_day
      on selected_day.id = selected_slot.workout_day_id
    join public.workout_plans plan on plan.id = selected_day.workout_plan_id
    where selected_slot.id = p_workout_day_exercise_id
      and plan.user_id = p_user_id
      and plan.status = 'active'
  ), plan_days as (
    select day.id, day.name, day.position
    from public.workout_days day
    join selected_plan plan on plan.id = day.workout_plan_id
  ), virtual_slots as (
    select day.id day_id, day.name day_name, day.position day_position,
      item.id slot_id, item.position slot_position,
      case when item.id = p_workout_day_exercise_id
        then p_candidate_exercise_id else item.exercise_id end exercise_id,
      exercise.category, exercise.movement_pattern,
      item.rep_min, item.rep_max, item.rest_seconds,
      private.exercise_media_is_ready(exercise.id) media_ready,
      private.exercise_auto_plan_reasons(
        exercise.id, (select user_id from selected_plan)
      ) eligibility_reasons
    from plan_days day
    join public.workout_day_exercises item on item.workout_day_id = day.id
    join public.exercises exercise on exercise.id = case
      when item.id = p_workout_day_exercise_id
        then p_candidate_exercise_id else item.exercise_id end
  ), assessed_slots as (
    select slot.*,
      coalesce(cardinality(slot.eligibility_reasons), 0) = 0
      or (
        slot.exercise_id = (select retained_avoid_exercise_id from selected_plan)
        and 'user_avoid' = any(slot.eligibility_reasons)
        and slot.eligibility_reasons <@ array['user_avoid']::text[]
      ) eligible,
      'unavailable_equipment' = any(slot.eligibility_reasons)
        invalid_equipment
    from virtual_slots slot
  ), frequency as (
    select exercise_id, count(*)::integer uses,
      count(distinct day_id)::integer days_used
    from assessed_slots group by exercise_id
  ), day_sizes as (
    select day_id, day_name, day_position,
      count(distinct exercise_id)::numeric size
    from assessed_slots group by day_id, day_name, day_position
  ), day_pairs as (
    select left_day.day_name || ' x ' || right_day.day_name pair,
      case when least(left_day.size, right_day.size) = 0 then 0 else round(
        100.0 * count(distinct left_slot.exercise_id) filter (
          where right_slot.exercise_id is not null
        ) / least(left_day.size, right_day.size), 1
      ) end overlap
    from day_sizes left_day
    join day_sizes right_day
      on right_day.day_position > left_day.day_position
    left join assessed_slots left_slot on left_slot.day_id = left_day.day_id
    left join assessed_slots right_slot
      on right_slot.day_id = right_day.day_id
      and right_slot.exercise_id = left_slot.exercise_id
    group by left_day.day_name, right_day.day_name,
      left_day.day_position, right_day.day_position,
      left_day.size, right_day.size
  ), movement as (
    select movement_pattern, count(*)::integer slots
    from assessed_slots group by movement_pattern
  ), metrics as (
    select count(*)::integer total_slots,
      count(*) filter (where category = 'strength')::integer strength_slots,
      count(*) filter (where category = 'cardio')::integer cardio_slots,
      count(*) filter (
        where category = 'mobility' or movement_pattern = 'posture'
      )::integer mobility_slots,
      count(*) filter (
        where category = 'strength' and rep_max between 1 and 8
      )::integer lower_rep_slots,
      count(*) filter (
        where category = 'strength' and rep_min >= 8 and rep_max <= 15
      )::integer moderate_rep_slots,
      count(*) filter (
        where category = 'strength' and rest_seconds >= 105
      )::integer long_rest_slots,
      count(*) filter (where media_ready)::integer media_ready_slots,
      count(*) filter (where not eligible)::integer ineligible_slots,
      count(*) filter (where invalid_equipment)::integer invalid_equipment_slots
    from assessed_slots
  ), evaluated as (
    select plan.*, metrics.*,
      (select count(*)::integer from plan_days) day_count,
      (select count(*)::integer from frequency) unique_exercises,
      coalesce((select max(uses) from frequency), 0) max_frequency,
      coalesce((select max(overlap) from day_pairs), 0) max_overlap,
      (select count(*)::integer from movement) movement_count,
      coalesce((select count(*)::integer from frequency
        where days_used = (select count(*) from plan_days)
          and (select count(*) from plan_days) > 1), 0) all_days_count,
      case
        when plan.goal_code = 'strength' then
          metrics.strength_slots >= metrics.total_slots * 0.75
          and metrics.lower_rep_slots >= metrics.strength_slots * 0.5
          and metrics.long_rest_slots >= metrics.strength_slots * 0.5
        when plan.goal_code = 'muscle_gain' then
          metrics.strength_slots >= metrics.total_slots * 0.75
          and metrics.moderate_rep_slots >= metrics.strength_slots * 0.7
        when plan.goal_code in (
          'conditioning', 'cardio_endurance', 'fat_loss',
          'weight_loss', 'measurements'
        ) then
          metrics.cardio_slots >= (select count(*) from plan_days)
          and metrics.strength_slots >= (select count(*) * 2 from plan_days)
        when plan.goal_code in ('mobility', 'posture') then
          metrics.mobility_slots >= (select count(*) from plan_days)
          and metrics.strength_slots >= (select count(*) * 3 from plan_days)
        else
          metrics.strength_slots >= (select count(*) * 3 from plan_days)
          and ((select count(*) from plan_days) < 3 or metrics.mobility_slots >= 1)
          and ((select count(*) from plan_days) < 3 or metrics.cardio_slots >= 1)
      end goal_aligned
    from selected_plan plan cross join metrics
  ), result as (
    select evaluated.*,
      total_slots > 0
      and media_ready_slots = total_slots
      and ineligible_slots = 0
      and invalid_equipment_slots = 0
      and goal_aligned
      and (
        sessions_per_week <> 3 or target_session_minutes <> 60
        or (
          total_slots = 18 and unique_exercises >= 12
          and max_frequency <= 2 and all_days_count = 0
          and max_overlap <= 50 and movement_count >= 8
        )
      ) direct_safe
    from evaluated
  )
  select jsonb_build_object(
    'status', case when direct_safe then 'PASS' else 'FAIL' end,
    'goalAlignment', case when goal_aligned then 'PASS' else 'FAIL' end,
    'mediaCoveragePercent', case when total_slots = 0 then 0 else
      round(100.0 * media_ready_slots / total_slots, 1) end,
    'eligible', ineligible_slots = 0,
    'equipmentCompatible', invalid_equipment_slots = 0,
    'uniqueExercises', unique_exercises,
    'maxExactExerciseFrequency', max_frequency,
    'maxDayPairOverlapPercent', max_overlap,
    'movementPatternCount', movement_count
  )
  from result;
$$;

revoke all on function private.simulate_plan_replacement_v214(uuid,uuid,uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;

create or replace function private.plan_replacement_type_v214(
  p_workout_day_exercise_id uuid,
  p_candidate_exercise_id uuid,
  p_user_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare source_exercise_id uuid; simulation jsonb;
begin
  select slot.exercise_id into source_exercise_id
  from public.workout_day_exercises slot
  join public.workout_days day on day.id = slot.workout_day_id
  join public.workout_plans plan on plan.id = day.workout_plan_id
  where slot.id = p_workout_day_exercise_id
    and plan.user_id = p_user_id and plan.status = 'active';
  if source_exercise_id is null then raise exception 'Slot de plano ativo não encontrado'; end if;
  if private.exercises_are_semantically_equivalent_v212(
    source_exercise_id, p_candidate_exercise_id
  ) then return 'DIRECT_EQUIVALENT'; end if;
  simulation := private.simulate_plan_replacement_v214(
    p_workout_day_exercise_id, p_candidate_exercise_id, p_user_id
  );
  if simulation->>'status' = 'PASS' then
    return 'GOAL_ALIGNED_ALTERNATIVE';
  end if;
  return 'REQUIRES_REBALANCE';
end;
$$;

revoke all on function private.plan_replacement_type_v214(uuid,uuid,uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;

create or replace function private.plan_replacement_candidates_v214(
  p_workout_day_exercise_id uuid,
  p_query text default null,
  p_limit integer default 12,
  p_offset integer default 0,
  p_reason_code text default 'user_choice'
)
returns table (
  exercise_id uuid,
  exercise_name text,
  movement_pattern text,
  training_role text,
  category text,
  difficulty text,
  primary_muscles text[],
  secondary_muscles text[],
  equipment_names text[],
  equipment_slugs text[],
  media_storage_path text,
  media_poster_path text,
  media_type text,
  replacement_type text,
  reason text,
  goal_alignment_reason text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_query text := nullif(btrim(p_query), '');
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  if p_limit not between 1 and 30 or p_offset < 0 then
    raise exception 'Paginação inválida';
  end if;
  if p_reason_code not in (
    'occupied_today', 'equipment_missing', 'exercise_dislike',
    'user_choice', 'other'
  ) then raise exception 'Motivo de troca inválido'; end if;

  return query
  with source_context as (
    select source.*, day.workout_plan_id, day.id day_id,
      coalesce(plan.goal_code, goal.goal_code, 'general_health') selected_goal
    from public.workout_day_exercises slot
    join public.workout_days day on day.id = slot.workout_day_id
    join public.workout_plans plan on plan.id = day.workout_plan_id
    join public.exercises source on source.id = slot.exercise_id
    left join lateral (
      select user_goal.goal_code
      from public.user_goals user_goal
      where user_goal.user_id = current_user_id and user_goal.active
      order by user_goal.priority, user_goal.goal_code limit 1
    ) goal on true
    where slot.id = p_workout_day_exercise_id
      and plan.user_id = current_user_id and plan.status = 'active'
  ), eligible as (
    select candidate.*, source.workout_plan_id, source.selected_goal,
      source.id source_exercise_id,
      source.movement_pattern source_pattern,
      source.training_role source_role,
      source.category source_category,
      source.difficulty source_difficulty,
      source.primary_muscles source_primary,
      source.secondary_muscles source_secondary,
      private.plan_replacement_type_v214(
        p_workout_day_exercise_id, candidate.id, current_user_id
      ) candidate_type,
      coalesce(explicit.score, 0)
        + case when candidate.movement_pattern = source.movement_pattern then 70 else 0 end
        + case when candidate.training_role = source.training_role then 45 else 0 end
        + case when candidate.primary_muscles && source.primary_muscles then 30 else 0 end
        + case when candidate.secondary_muscles && source.secondary_muscles then 8 else 0 end
        + case when candidate.difficulty = source.difficulty then 12 else 0 end
        + case
            when source.selected_goal in ('strength','muscle_gain')
              and candidate.category = 'strength' then 25
            when source.selected_goal in (
              'conditioning','cardio_endurance','fat_loss','weight_loss','measurements'
            ) and candidate.category = 'cardio' then 25
            when source.selected_goal in ('mobility','posture')
              and (candidate.category = 'mobility' or candidate.movement_pattern = 'posture')
              then 25
            when source.selected_goal not in (
              'strength','muscle_gain','conditioning','cardio_endurance',
              'fat_loss','weight_loss','measurements','mobility','posture'
            ) and candidate.category = 'strength' then 15
            else 0
          end
        - 18 * coalesce((
            select count(*)
            from public.workout_sessions recent_session
            join public.workout_session_exercises recent_exercise
              on recent_exercise.workout_session_id = recent_session.id
            where recent_session.user_id = current_user_id
              and recent_exercise.actual_exercise_id = candidate.id
              and recent_session.started_at >= now() - interval '21 days'
          ), 0) as rank_score
    from source_context source
    join public.exercises candidate on candidate.id <> source.id
    left join public.exercise_substitutions explicit
      on explicit.exercise_id = source.id
      and explicit.alternative_exercise_id = candidate.id
    where candidate.active
      and private.exercise_media_is_ready(candidate.id)
      and private.exercise_auto_plan_eligible(candidate.id, current_user_id)
      and (
        normalized_query is null
        or candidate.name_pt ilike '%' || normalized_query || '%'
        or candidate.slug ilike '%' || normalized_query || '%'
        or exists (
          select 1
          from unnest(candidate.primary_muscles || candidate.secondary_muscles) muscle
          where muscle ilike '%' || normalized_query || '%'
        )
      )
      and not exists (
        select 1
        from public.workout_days existing_day
        join public.workout_day_exercises existing_slot
          on existing_slot.workout_day_id = existing_day.id
        where existing_day.workout_plan_id = source.workout_plan_id
          and existing_slot.exercise_id = candidate.id
      )
  ), hydrated as (
    select eligible.*,
      coalesce((
        select array_agg(equipment.name order by equipment.name)
        from public.exercise_equipment link
        join public.equipment equipment on equipment.id = link.equipment_id
        where link.exercise_id = eligible.id and link.required
      ), '{}'::text[]) candidate_equipment_names,
      coalesce((
        select array_agg(equipment.slug order by equipment.slug)
        from public.exercise_equipment link
        join public.equipment equipment on equipment.id = link.equipment_id
        where link.exercise_id = eligible.id and link.required
      ), '{}'::text[]) candidate_equipment_slugs,
      media.storage_path, media.poster_path, media.media_type
    from eligible
    join lateral (
      select approved.storage_path, approved.poster_path, approved.media_type
      from public.exercise_media approved
      where approved.exercise_id = eligible.id
        and approved.status = 'approved'
        and approved.execution_quality = 'approved'
        and approved.media_role = 'PRIMARY_DEMO'
        and approved.is_primary
        and approved.review_state = 'PUBLISHED'
      order by approved.sort_order, approved.id limit 1
    ) media on true
  ), counted as (
    select hydrated.*, count(*) over() candidate_count from hydrated
  )
  select counted.id, counted.name_pt, counted.movement_pattern,
    counted.training_role, counted.category, counted.difficulty,
    counted.primary_muscles, counted.secondary_muscles,
    counted.candidate_equipment_names, counted.candidate_equipment_slugs,
    counted.storage_path, counted.poster_path, counted.media_type,
    counted.candidate_type,
    case counted.candidate_type
      when 'DIRECT_EQUIVALENT' then
        case counted.movement_pattern
          when 'horizontal_push' then 'Mesmo padrão de empurrar horizontal'
          when 'vertical_push' then 'Mesmo padrão de empurrar vertical'
          when 'horizontal_pull' then 'Mesmo padrão de puxar horizontal'
          when 'vertical_pull' then 'Mesmo padrão de puxar vertical'
          when 'knee_flexion' then 'Mesmo foco em posteriores de coxa'
          else 'Mesma função, padrão e grupo muscular no treino'
        end
      when 'GOAL_ALIGNED_ALTERNATIVE' then
        'Alternativa segura que mantém a qualidade do plano completo'
      else 'Exige reorganizar outro exercício para preservar o plano'
    end,
    case
      when counted.selected_goal = 'strength' then 'Mantém o foco de força e os critérios semanais'
      when counted.selected_goal = 'muscle_gain' then 'Mantém o volume de hipertrofia e a diversidade semanal'
      when counted.selected_goal in (
        'conditioning','cardio_endurance','fat_loss','weight_loss','measurements'
      ) then 'Preserva o condicionamento e o equilíbrio entre os dias'
      when counted.selected_goal in ('mobility','posture') then
        'Preserva a cobertura de mobilidade e postura do plano'
      else 'Preserva o objetivo e a diversidade do plano semanal'
    end,
    counted.candidate_count
  from counted
  order by case counted.candidate_type
      when 'DIRECT_EQUIVALENT' then 0
      when 'GOAL_ALIGNED_ALTERNATIVE' then 1
      else 2
    end,
    counted.rank_score desc, counted.name_pt, counted.id
  limit p_limit offset p_offset;
end;
$$;

revoke all on function private.plan_replacement_candidates_v214(uuid,text,integer,integer,text)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function private.plan_replacement_candidates_v214(uuid,text,integer,integer,text)
  to authenticated;

create or replace function public.get_plan_replacement_candidates_v214(
  p_workout_day_exercise_id uuid,
  p_query text default null,
  p_limit integer default 12,
  p_offset integer default 0,
  p_reason_code text default 'user_choice'
)
returns table (
  exercise_id uuid,
  exercise_name text,
  movement_pattern text,
  training_role text,
  category text,
  difficulty text,
  primary_muscles text[],
  secondary_muscles text[],
  equipment_names text[],
  equipment_slugs text[],
  media_storage_path text,
  media_poster_path text,
  media_type text,
  replacement_type text,
  reason text,
  goal_alignment_reason text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.plan_replacement_candidates_v214($1, $2, $3, $4, $5);
$$;

revoke all on function public.get_plan_replacement_candidates_v214(uuid,text,integer,integer,text)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.get_plan_replacement_candidates_v214(uuid,text,integer,integer,text)
  to authenticated;

create or replace function private.replace_plan_exercise_v214_internal(
  p_workout_day_exercise_id uuid,
  p_replacement_exercise_id uuid,
  p_replacement_type text,
  p_reason_code text default 'user_choice',
  p_persist_exclusion boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  actual_type text;
  source_context record;
  replacement_name text;
  cloned_plan_id uuid;
  cloned_day_id uuid;
  cloned_slot_id uuid;
  event_id uuid;
  quality jsonb;
  result jsonb;
  previous_preference public.user_exercise_preferences%rowtype;
  preference_had_row boolean := false;
  remaining_occurrence_count integer := 0;
  retained_avoid_exercise_id uuid;
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  if p_reason_code not in (
    'occupied_today', 'equipment_missing', 'exercise_dislike',
    'user_choice', 'other'
  ) then raise exception 'Motivo de troca inválido'; end if;
  if p_replacement_type not in (
    'DIRECT_EQUIVALENT', 'GOAL_ALIGNED_ALTERNATIVE'
  ) then raise exception 'Esta opção exige uma prévia de reorganização'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 214)
  );
  actual_type := private.plan_replacement_type_v214(
    p_workout_day_exercise_id, p_replacement_exercise_id, current_user_id
  );
  if actual_type <> p_replacement_type then
    raise exception 'A classificação da alternativa mudou; atualize as opções';
  end if;

  if actual_type = 'DIRECT_EQUIVALENT' then
    result := private.replace_plan_exercise_v212_internal(
      p_workout_day_exercise_id,
      p_replacement_exercise_id,
      p_persist_exclusion
    );
    event_id := (result->>'eventId')::uuid;
    cloned_plan_id := (result->>'planId')::uuid;
    update public.plan_exercise_change_events
    set replacement_type = actual_type,
      reason_code = p_reason_code,
      scope = 'plan',
      metadata = metadata || jsonb_build_object(
        'source', 'v2.1.4', 'classificationVerified', true
      )
    where id = event_id and user_id = current_user_id;
    update public.workout_plans
    set generator_version = 'v2.1.4',
      generation_rationale = generation_rationale || jsonb_build_object(
        'v214Replacement', jsonb_build_object(
          'replacementType', actual_type, 'reasonCode', p_reason_code
        )
      ), updated_at = now()
    where id = cloned_plan_id;
    return result || jsonb_build_object(
      'replacementType', actual_type, 'reasonCode', p_reason_code
    );
  end if;

  select plan.id plan_id, day.position day_position,
    slot.position slot_position, slot.exercise_id source_exercise_id,
    source.name_pt source_name
  into source_context
  from public.workout_day_exercises slot
  join public.workout_days day on day.id = slot.workout_day_id
  join public.workout_plans plan on plan.id = day.workout_plan_id
  join public.exercises source on source.id = slot.exercise_id
  where slot.id = p_workout_day_exercise_id
    and plan.user_id = current_user_id and plan.status = 'active'
  for update of plan;
  if not found then raise exception 'Slot de plano ativo não encontrado'; end if;
  if not private.exercise_media_is_ready(p_replacement_exercise_id)
     or not private.exercise_auto_plan_eligible(
       p_replacement_exercise_id, current_user_id
     ) then raise exception 'Exercício indisponível para este plano'; end if;
  if exists (
    select 1 from public.workout_days day
    join public.workout_day_exercises slot on slot.workout_day_id = day.id
    where day.workout_plan_id = source_context.plan_id
      and slot.exercise_id = p_replacement_exercise_id
  ) then raise exception 'Este exercício já faz parte do plano'; end if;

  select exercise.name_pt into replacement_name
  from public.exercises exercise
  where exercise.id = p_replacement_exercise_id and exercise.active;
  if replacement_name is null then raise exception 'Exercício não encontrado'; end if;

  select * into previous_preference
  from public.user_exercise_preferences preference
  where preference.user_id = current_user_id
    and preference.exercise_id = source_context.source_exercise_id;
  preference_had_row := found;
  if p_persist_exclusion then
    insert into public.user_exercise_preferences(user_id, exercise_id, preference)
    values(current_user_id, source_context.source_exercise_id, 'avoid')
    on conflict(user_id, exercise_id) do update set
      preference = 'avoid', updated_at = now();
  end if;

  cloned_plan_id := private.clone_plan_v212(
    source_context.plan_id,
    current_user_id,
    jsonb_build_object('v214Replacement', jsonb_build_object(
      'replacementType', actual_type,
      'reasonCode', p_reason_code,
      'sourcePlanId', source_context.plan_id,
      'sourceSlotId', p_workout_day_exercise_id
    ))
  );
  select day.id, slot.id into cloned_day_id, cloned_slot_id
  from public.workout_days day
  join public.workout_day_exercises slot on slot.workout_day_id = day.id
  where day.workout_plan_id = cloned_plan_id
    and day.position = source_context.day_position
    and slot.position = source_context.slot_position;
  update public.workout_day_exercises
  set exercise_id = p_replacement_exercise_id, updated_at = now()
  where id = cloned_slot_id;

  select count(*)::integer into remaining_occurrence_count
  from public.workout_days day
  join public.workout_day_exercises slot on slot.workout_day_id = day.id
  where day.workout_plan_id = cloned_plan_id
    and slot.exercise_id = source_context.source_exercise_id;
  if p_persist_exclusion and remaining_occurrence_count > 0 then
    retained_avoid_exercise_id := source_context.source_exercise_id;
  end if;
  update public.workout_plans
  set generator_version = 'v2.1.4',
    generation_rationale = generation_rationale || jsonb_build_object(
      'v213RetainedAvoid', case when retained_avoid_exercise_id is null then null
        else jsonb_build_object(
          'exerciseId', retained_avoid_exercise_id, 'sourceEventPending', true
        ) end
    ), updated_at = now()
  where id = cloned_plan_id;
  quality := private.assert_plan_quality_v213(
    cloned_plan_id, retained_avoid_exercise_id
  );
  update public.workout_plans set quality_metrics = quality, updated_at = now()
  where id = cloned_plan_id;
  update public.workout_plans
  set status = 'archived', archived_at = now(), updated_at = now()
  where id = source_context.plan_id and status = 'active';
  if not found then raise exception 'O plano ativo mudou; tente novamente'; end if;
  update public.workout_plans
  set status = 'active', activated_at = now(), archived_at = null, updated_at = now()
  where id = cloned_plan_id and status = 'draft';
  if not found then raise exception 'Não foi possível ativar a nova versão'; end if;

  insert into public.plan_exercise_change_events(
    user_id, source_plan_id, resulting_plan_id, source_slot_id,
    resulting_slot_id, from_exercise_id, to_exercise_id, change_type,
    changes, persistent_exclusion, preference_had_row,
    preference_previous_value, replacement_type, reason_code, scope, metadata
  ) values (
    current_user_id, source_context.plan_id, cloned_plan_id,
    p_workout_day_exercise_id, cloned_slot_id,
    source_context.source_exercise_id, p_replacement_exercise_id,
    'goal_aligned', jsonb_build_array(jsonb_build_object(
      'before', source_context.source_name,
      'after', replacement_name,
      'dayPosition', source_context.day_position,
      'slotPosition', source_context.slot_position
    )), p_persist_exclusion, preference_had_row,
    previous_preference.preference, actual_type, p_reason_code, 'plan',
    jsonb_build_object('source', 'v2.1.4', 'classificationVerified', true)
  ) returning id into event_id;
  update public.workout_plans
  set generation_rationale = jsonb_set(
    generation_rationale, '{v213RetainedAvoid,sourceEventId}',
    to_jsonb(event_id::text), true
  ) #- '{v213RetainedAvoid,sourceEventPending}'
  where id = cloned_plan_id and retained_avoid_exercise_id is not null;

  return jsonb_build_object(
    'eventId', event_id, 'planId', cloned_plan_id, 'dayId', cloned_day_id,
    'exerciseId', p_replacement_exercise_id, 'exerciseName', replacement_name,
    'sourceExerciseId', source_context.source_exercise_id,
    'sourceExerciseName', source_context.source_name,
    'persistentExclusion', p_persist_exclusion,
    'remainingOccurrenceCount', remaining_occurrence_count,
    'replacementType', actual_type, 'reasonCode', p_reason_code,
    'quality', quality
  );
end;
$$;

revoke all on function private.replace_plan_exercise_v214_internal(uuid,uuid,text,text,boolean)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function private.replace_plan_exercise_v214_internal(uuid,uuid,text,text,boolean)
  to authenticated;

create or replace function public.replace_plan_exercise_v214(
  p_workout_day_exercise_id uuid,
  p_replacement_exercise_id uuid,
  p_replacement_type text,
  p_reason_code text default 'user_choice',
  p_persist_exclusion boolean default false
)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.replace_plan_exercise_v214_internal($1,$2,$3,$4,$5);
$$;
revoke all on function public.replace_plan_exercise_v214(uuid,uuid,text,text,boolean)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.replace_plan_exercise_v214(uuid,uuid,text,text,boolean)
  to authenticated;

create or replace function private.preview_plan_rebalance_v214_internal(
  p_workout_day_exercise_id uuid,
  p_desired_exercise_id uuid,
  p_reason_code text default 'user_choice'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare current_user_id uuid := auth.uid(); candidate_type text; result jsonb;
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  if p_reason_code not in (
    'occupied_today', 'equipment_missing', 'exercise_dislike',
    'user_choice', 'other'
  ) then raise exception 'Motivo de troca inválido'; end if;
  candidate_type := private.plan_replacement_type_v214(
    p_workout_day_exercise_id, p_desired_exercise_id, current_user_id
  );
  if candidate_type <> 'REQUIRES_REBALANCE' then
    raise exception 'Esta alternativa não exige reorganização';
  end if;
  result := private.preview_plan_rebalance_v212_internal(
    p_workout_day_exercise_id, p_desired_exercise_id
  );
  update public.workout_plans
  set generation_rationale = generation_rationale || jsonb_build_object(
      'v214Rebalance', jsonb_build_object(
        'replacementType', 'PLAN_REBALANCE',
        'candidateType', candidate_type,
        'reasonCode', p_reason_code
      )
    ), updated_at = now()
  where id = (result->>'planId')::uuid and user_id = current_user_id
    and status = 'draft';
  return result || jsonb_build_object(
    'replacementType', 'PLAN_REBALANCE', 'candidateType', candidate_type,
    'reasonCode', p_reason_code
  );
end;
$$;
revoke all on function private.preview_plan_rebalance_v214_internal(uuid,uuid,text)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function private.preview_plan_rebalance_v214_internal(uuid,uuid,text)
  to authenticated;

create or replace function public.preview_plan_rebalance_v214(
  p_workout_day_exercise_id uuid,
  p_desired_exercise_id uuid,
  p_reason_code text default 'user_choice'
)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.preview_plan_rebalance_v214_internal($1,$2,$3);
$$;
revoke all on function public.preview_plan_rebalance_v214(uuid,uuid,text)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.preview_plan_rebalance_v214(uuid,uuid,text)
  to authenticated;

create or replace function private.activate_plan_rebalance_v214_internal(
  p_plan_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v214_metadata jsonb;
  result jsonb;
  event_id uuid;
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  select plan.generation_rationale->'v214Rebalance' into v214_metadata
  from public.workout_plans plan
  where plan.id = p_plan_id and plan.user_id = current_user_id
    and plan.status = 'draft' and plan.generator_version = 'v2.1.2';
  if v214_metadata is null then raise exception 'Prévia v2.1.4 não encontrada'; end if;
  result := private.activate_plan_rebalance_v212_internal(p_plan_id);
  event_id := (result->>'eventId')::uuid;
  update public.plan_exercise_change_events
  set replacement_type = 'PLAN_REBALANCE',
    reason_code = v214_metadata->>'reasonCode', scope = 'plan',
    metadata = metadata || jsonb_build_object(
      'source', 'v2.1.4', 'candidateType', 'REQUIRES_REBALANCE'
    )
  where id = event_id and user_id = current_user_id;
  update public.workout_plans
  set generator_version = 'v2.1.4', updated_at = now()
  where id = p_plan_id and user_id = current_user_id and status = 'active';
  return result || jsonb_build_object(
    'replacementType', 'PLAN_REBALANCE',
    'reasonCode', v214_metadata->>'reasonCode'
  );
end;
$$;
revoke all on function private.activate_plan_rebalance_v214_internal(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function private.activate_plan_rebalance_v214_internal(uuid)
  to authenticated;

create or replace function public.activate_plan_rebalance_v214(p_plan_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.activate_plan_rebalance_v214_internal($1);
$$;
revoke all on function public.activate_plan_rebalance_v214(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.activate_plan_rebalance_v214(uuid)
  to authenticated;

create or replace function private.workout_replacement_candidates_v214(
  p_session_exercise_id uuid,
  p_reason_code text default 'user_choice',
  p_equipment_id uuid default null,
  p_query text default null,
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  exercise_id uuid,
  exercise_name text,
  movement_pattern text,
  training_role text,
  category text,
  difficulty text,
  primary_muscles text[],
  equipment_names text[],
  media_storage_path text,
  media_poster_path text,
  media_type text,
  replacement_type text,
  reason text,
  goal_alignment_reason text,
  total_count bigint
)
language plpgsql stable security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  normalized_query text := nullif(btrim(p_query), '');
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  if p_reason_code not in (
    'occupied_today','equipment_missing','exercise_dislike','user_choice','other'
  ) then raise exception 'Motivo de troca inválido'; end if;
  if p_limit not between 1 and 30 or p_offset < 0 then
    raise exception 'Paginação inválida';
  end if;
  if p_reason_code = 'equipment_missing' and p_equipment_id is null then
    raise exception 'Selecione o equipamento indisponível';
  end if;
  if p_reason_code <> 'equipment_missing' and p_equipment_id is not null then
    raise exception 'Equipamento não deve ser informado para este motivo';
  end if;

  return query
  with context as (
    select current_exercise.*, session.id session_id,
      coalesce(plan.goal_code, goal.goal_code, 'general_health') selected_goal
    from public.workout_session_exercises session_exercise
    join public.workout_sessions session
      on session.id = session_exercise.workout_session_id
    join public.exercises current_exercise
      on current_exercise.id = session_exercise.actual_exercise_id
    left join public.workout_plans plan on plan.id = session.workout_plan_id
    left join lateral (
      select user_goal.goal_code from public.user_goals user_goal
      where user_goal.user_id = current_user_id and user_goal.active
      order by user_goal.priority, user_goal.goal_code limit 1
    ) goal on true
    where session_exercise.id = p_session_exercise_id
      and session.user_id = current_user_id and session.status = 'in_progress'
  ), ranked as (
    select candidate.*, source.session_id, source.selected_goal,
      case when private.exercises_are_semantically_equivalent_v212(
        source.id, candidate.id
      ) then 'DIRECT_EQUIVALENT' else 'GOAL_ALIGNED_ALTERNATIVE' end candidate_type,
      coalesce(explicit.score, 0)
        + case when candidate.movement_pattern = source.movement_pattern then 70 else 0 end
        + case when candidate.training_role = source.training_role then 45 else 0 end
        + case when candidate.primary_muscles && source.primary_muscles then 30 else 0 end
        + case when candidate.difficulty = source.difficulty then 12 else 0 end
        + case
            when source.selected_goal in ('strength','muscle_gain')
              and candidate.category = 'strength' then 25
            when source.selected_goal in (
              'conditioning','cardio_endurance','fat_loss','weight_loss','measurements'
            ) and candidate.category = 'cardio' then 25
            when source.selected_goal in ('mobility','posture')
              and (candidate.category = 'mobility' or candidate.movement_pattern = 'posture')
              then 25 else 0 end
        - case when p_reason_code = 'occupied_today' and exists (
            select 1 from public.exercise_equipment source_link
            join public.exercise_equipment candidate_link
              on candidate_link.equipment_id = source_link.equipment_id
              and candidate_link.required
            join public.equipment shared on shared.id = source_link.equipment_id
            where source_link.exercise_id = source.id and source_link.required
              and shared.slug <> 'bodyweight'
              and candidate_link.exercise_id = candidate.id
          ) then 80 else 0 end rank_score
    from context source
    join public.exercises candidate on candidate.active and candidate.id <> source.id
    left join public.exercise_substitutions explicit
      on explicit.exercise_id = source.id
      and explicit.alternative_exercise_id = candidate.id
    where private.exercise_media_is_ready(candidate.id)
      and (
        private.exercises_are_semantically_equivalent_v212(source.id, candidate.id)
        or (
          candidate.category = source.category
          and candidate.primary_muscles && source.primary_muscles
          and (
            candidate.training_role = source.training_role
            or candidate.movement_pattern = source.movement_pattern
          )
        )
      )
      and not exists (
        select 1 from public.user_exercise_preferences preference
        where preference.user_id = current_user_id
          and preference.exercise_id = candidate.id
          and preference.preference = 'avoid'
      )
      and not exists (
        select 1 from public.user_movement_attention attention
        where attention.user_id = current_user_id and attention.active
          and (
            (attention.region = 'knee' and candidate.movement_pattern in ('squat','knee_extension','knee_flexion'))
            or (attention.region = 'shoulder' and candidate.movement_pattern in ('horizontal_push','vertical_push'))
            or (attention.region = 'lower_back' and candidate.movement_pattern in ('hinge','core_flexion'))
            or (attention.region = 'hip' and candidate.movement_pattern in ('squat','hinge','hip_extension'))
            or (attention.region = 'ankle' and candidate.movement_pattern in ('squat','knee_extension','cardio'))
            or (attention.region = 'wrist' and candidate.movement_pattern in ('horizontal_push','vertical_push','carry'))
          )
      )
      and not exists (
        select 1 from public.exercise_equipment required_link
        join public.equipment equipment on equipment.id = required_link.equipment_id
        where required_link.exercise_id = candidate.id and required_link.required
          and equipment.slug <> 'bodyweight'
          and (
            required_link.equipment_id = p_equipment_id
            or not private.user_equipment_is_available(
              current_user_id, required_link.equipment_id
            )
          )
      )
      and not exists (
        select 1 from public.workout_session_exercises existing
        where existing.workout_session_id = source.session_id
          and existing.id <> p_session_exercise_id
          and existing.actual_exercise_id = candidate.id
      )
      and (
        normalized_query is null
        or candidate.name_pt ilike '%' || normalized_query || '%'
        or candidate.slug ilike '%' || normalized_query || '%'
      )
  ), hydrated as (
    select ranked.*,
      coalesce((select array_agg(equipment.name order by equipment.name)
        from public.exercise_equipment link
        join public.equipment equipment on equipment.id = link.equipment_id
        where link.exercise_id = ranked.id and link.required), '{}') candidate_equipment,
      media.storage_path, media.poster_path, media.media_type
    from ranked
    join lateral (
      select approved.storage_path, approved.poster_path, approved.media_type
      from public.exercise_media approved
      where approved.exercise_id = ranked.id
        and approved.status = 'approved' and approved.execution_quality = 'approved'
        and approved.media_role = 'PRIMARY_DEMO' and approved.is_primary
        and approved.review_state = 'PUBLISHED'
      order by approved.sort_order, approved.id limit 1
    ) media on true
  ), counted as (
    select hydrated.*, count(*) over() candidate_count from hydrated
  )
  select counted.id, counted.name_pt, counted.movement_pattern,
    counted.training_role, counted.category, counted.difficulty,
    counted.primary_muscles, counted.candidate_equipment,
    counted.storage_path, counted.poster_path, counted.media_type,
    counted.candidate_type,
    case counted.candidate_type
      when 'DIRECT_EQUIVALENT' then 'Mesma função no treino de hoje'
      else 'Outra boa opção para o mesmo objetivo nesta sessão' end,
    case
      when counted.selected_goal = 'strength' then 'Mantém o foco de força da sessão'
      when counted.selected_goal = 'muscle_gain' then 'Mantém o foco de hipertrofia da sessão'
      else 'Mantém a intenção do treino de hoje' end,
    counted.candidate_count
  from counted
  order by case counted.candidate_type when 'DIRECT_EQUIVALENT' then 0 else 1 end,
    counted.rank_score desc, counted.name_pt, counted.id
  limit p_limit offset p_offset;
end;
$$;

revoke all on function private.workout_replacement_candidates_v214(uuid,text,uuid,text,integer,integer)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function private.workout_replacement_candidates_v214(uuid,text,uuid,text,integer,integer)
  to authenticated;

create or replace function public.get_workout_replacement_candidates_v214(
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
  primary_muscles text[], equipment_names text[],
  media_storage_path text, media_poster_path text, media_type text,
  replacement_type text, reason text, goal_alignment_reason text,
  total_count bigint
)
language sql stable security invoker set search_path = '' as $$
  select * from private.workout_replacement_candidates_v214($1,$2,$3,$4,$5,$6);
$$;
revoke all on function public.get_workout_replacement_candidates_v214(uuid,text,uuid,text,integer,integer)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.get_workout_replacement_candidates_v214(uuid,text,uuid,text,integer,integer)
  to authenticated;

create or replace function private.substitute_workout_exercise_v214_internal(
  p_session_exercise_id uuid,
  p_replacement_exercise_id uuid,
  p_replacement_type text,
  p_reason_code text default 'user_choice',
  p_equipment_id uuid default null,
  p_persist_change boolean default false
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  current_exercise_id uuid;
  candidate record;
  event_id uuid;
  previous_equipment public.user_equipment%rowtype;
  equipment_had_row boolean := false;
  previous_preference public.user_exercise_preferences%rowtype;
  preference_had_row boolean := false;
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  if p_replacement_type not in (
    'DIRECT_EQUIVALENT','GOAL_ALIGNED_ALTERNATIVE'
  ) then raise exception 'Reorganização semanal não é aplicada durante a sessão'; end if;
  if p_reason_code not in (
    'occupied_today','equipment_missing','exercise_dislike','user_choice','other'
  ) then raise exception 'Motivo de troca inválido'; end if;
  if p_reason_code = 'equipment_missing' and p_equipment_id is null then
    raise exception 'Selecione o equipamento indisponível';
  end if;
  if p_reason_code <> 'equipment_missing' and p_equipment_id is not null then
    raise exception 'Equipamento não deve ser informado para este motivo';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 214)
  );
  select session_exercise.actual_exercise_id into current_exercise_id
  from public.workout_session_exercises session_exercise
  join public.workout_sessions session
    on session.id = session_exercise.workout_session_id
  where session_exercise.id = p_session_exercise_id
    and session.user_id = current_user_id and session.status = 'in_progress'
  for update of session_exercise;
  if current_exercise_id is null then
    raise exception 'Exercício da sessão não encontrado';
  end if;
  if p_reason_code = 'equipment_missing' and not exists (
    select 1 from public.exercise_equipment link
    where link.exercise_id = current_exercise_id
      and link.equipment_id = p_equipment_id and link.required
  ) then raise exception 'Equipamento não pertence ao exercício atual'; end if;

  select exercise.* into candidate
  from private.workout_replacement_candidates_v214(
    p_session_exercise_id, p_reason_code, p_equipment_id, null, 30, 0
  ) exercise
  where exercise.exercise_id = p_replacement_exercise_id
    and exercise.replacement_type = p_replacement_type;
  if not found then
    raise exception 'A alternativa não está mais disponível; atualize as opções';
  end if;

  if p_reason_code = 'equipment_missing' then
    select * into previous_equipment from public.user_equipment
    where user_id = current_user_id and equipment_id = p_equipment_id;
    equipment_had_row := found;
    insert into public.user_equipment(
      user_id, equipment_id, available, source, temporary_unavailable_until
    ) values (
      current_user_id, p_equipment_id, not p_persist_change, 'user_override',
      case when p_persist_change then null else now() + interval '4 hours' end
    ) on conflict(user_id,equipment_id) do update set
      available = excluded.available, source = excluded.source,
      temporary_unavailable_until = excluded.temporary_unavailable_until,
      updated_at = now();
  end if;

  if p_reason_code = 'exercise_dislike' and p_persist_change then
    select * into previous_preference
    from public.user_exercise_preferences preference
    where preference.user_id = current_user_id
      and preference.exercise_id = current_exercise_id;
    preference_had_row := found;
    insert into public.user_exercise_preferences(user_id,exercise_id,preference)
    values(current_user_id,current_exercise_id,'avoid')
    on conflict(user_id,exercise_id) do update set
      preference = 'avoid', updated_at = now();
  end if;

  update public.workout_session_exercises
  set actual_exercise_id = p_replacement_exercise_id,
    substitution_reason = p_reason_code, updated_at = now()
  where id = p_session_exercise_id;
  if not found then raise exception 'Exercício da sessão não encontrado'; end if;

  insert into public.workout_substitution_events(
    user_id, session_exercise_id, from_exercise_id, to_exercise_id,
    reason, equipment_id, equipment_had_row,
    equipment_previous_available, equipment_previous_source,
    equipment_previous_temporary_unavailable_until,
    replacement_type, reason_code, scope, persistent_exclusion,
    preference_had_row, preference_previous_value, metadata
  ) values (
    current_user_id, p_session_exercise_id, current_exercise_id,
    p_replacement_exercise_id, p_reason_code, p_equipment_id,
    equipment_had_row, previous_equipment.available, previous_equipment.source,
    previous_equipment.temporary_unavailable_until,
    p_replacement_type, p_reason_code, 'session',
    p_reason_code = 'exercise_dislike' and p_persist_change,
    preference_had_row, previous_preference.preference,
    jsonb_build_object(
      'source', 'v2.1.4',
      'equipmentScope', case
        when p_reason_code <> 'equipment_missing' then null
        when p_persist_change then 'permanent' else 'temporary' end
    )
  ) returning id into event_id;

  return jsonb_build_object(
    'eventId', event_id, 'exerciseId', p_replacement_exercise_id,
    'exerciseName', candidate.exercise_name,
    'replacementType', p_replacement_type,
    'reasonCode', p_reason_code,
    'persistentChange', p_persist_change
  );
end;
$$;
revoke all on function private.substitute_workout_exercise_v214_internal(uuid,uuid,text,text,uuid,boolean)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function private.substitute_workout_exercise_v214_internal(uuid,uuid,text,text,uuid,boolean)
  to authenticated;

create or replace function public.substitute_workout_exercise_v214(
  p_session_exercise_id uuid,
  p_replacement_exercise_id uuid,
  p_replacement_type text,
  p_reason_code text default 'user_choice',
  p_equipment_id uuid default null,
  p_persist_change boolean default false
)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.substitute_workout_exercise_v214_internal($1,$2,$3,$4,$5,$6);
$$;
revoke all on function public.substitute_workout_exercise_v214(uuid,uuid,text,text,uuid,boolean)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.substitute_workout_exercise_v214(uuid,uuid,text,text,uuid,boolean)
  to authenticated;

create or replace function private.undo_workout_substitution_v214_internal(
  p_event_id uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  substitution_event public.workout_substitution_events%rowtype;
  restored_name text;
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 214)
  );
  select * into substitution_event
  from public.workout_substitution_events event
  where event.id = p_event_id and event.user_id = current_user_id
    and event.undone_at is null and event.metadata->>'source' = 'v2.1.4'
  for update;
  if not found then raise exception 'Substituição não encontrada ou já desfeita'; end if;
  if exists (
    select 1 from public.workout_substitution_events newer
    where newer.session_exercise_id = substitution_event.session_exercise_id
      and newer.user_id = current_user_id and newer.undone_at is null
      and (newer.created_at, newer.id) >
          (substitution_event.created_at, substitution_event.id)
  ) then raise exception 'Desfaça primeiro a substituição mais recente'; end if;

  update public.workout_session_exercises session_exercise
  set actual_exercise_id = substitution_event.from_exercise_id,
    substitution_reason = null, updated_at = now()
  from public.workout_sessions session
  where session_exercise.id = substitution_event.session_exercise_id
    and session.id = session_exercise.workout_session_id
    and session.user_id = current_user_id and session.status = 'in_progress';
  if not found then raise exception 'Sessão não está disponível para desfazer'; end if;

  if substitution_event.reason_code = 'equipment_missing'
     and substitution_event.equipment_id is not null then
    if substitution_event.equipment_had_row then
      update public.user_equipment set
        available = substitution_event.equipment_previous_available,
        source = substitution_event.equipment_previous_source,
        temporary_unavailable_until =
          substitution_event.equipment_previous_temporary_unavailable_until,
        updated_at = now()
      where user_id = current_user_id
        and equipment_id = substitution_event.equipment_id;
      if not found then raise exception 'Equipamento não pôde ser restaurado'; end if;
    else
      delete from public.user_equipment
      where user_id = current_user_id
        and equipment_id = substitution_event.equipment_id;
    end if;
  end if;
  if substitution_event.persistent_exclusion then
    if substitution_event.preference_had_row then
      insert into public.user_exercise_preferences(user_id,exercise_id,preference)
      values(current_user_id, substitution_event.from_exercise_id,
        substitution_event.preference_previous_value)
      on conflict(user_id,exercise_id) do update set
        preference = excluded.preference, updated_at = now();
    else
      delete from public.user_exercise_preferences
      where user_id = current_user_id
        and exercise_id = substitution_event.from_exercise_id;
    end if;
  end if;
  update public.workout_substitution_events set undone_at = now()
  where id = p_event_id and user_id = current_user_id and undone_at is null;
  select name_pt into restored_name from public.exercises
  where id = substitution_event.from_exercise_id;
  return jsonb_build_object(
    'exerciseId', substitution_event.from_exercise_id,
    'exerciseName', restored_name, 'eventId', p_event_id
  );
end;
$$;
revoke all on function private.undo_workout_substitution_v214_internal(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function private.undo_workout_substitution_v214_internal(uuid)
  to authenticated;

create or replace function public.undo_workout_substitution_v214(p_event_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.undo_workout_substitution_v214_internal($1);
$$;
revoke all on function public.undo_workout_substitution_v214(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.undo_workout_substitution_v214(uuid)
  to authenticated;

-- A session snapshot belongs to the plan version that created it. A stale
-- in-progress snapshot must never win over the user's current active plan.
create or replace function public.start_workout(p_workout_day_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  new_session uuid;
  existing_session_id uuid;
  existing_plan_id uuid;
  existing_plan_status text;
  owning_plan uuid;
  total_exercises integer;
  media_ready_exercises integer;
begin
  if current_user_id is null then raise exception 'Não autenticado'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 18)
  );

  select plan.id into owning_plan
  from public.workout_days day
  join public.workout_plans plan on plan.id = day.workout_plan_id
  where day.id = p_workout_day_id
    and plan.user_id = current_user_id
    and plan.status = 'active';
  if owning_plan is null then raise exception 'Treino ativo não encontrado'; end if;

  select session.id, session.workout_plan_id, plan.status
  into existing_session_id, existing_plan_id, existing_plan_status
  from public.workout_sessions session
  left join public.workout_plans plan on plan.id = session.workout_plan_id
  where session.user_id = current_user_id and session.status = 'in_progress'
  order by session.started_at desc
  limit 1
  for update of session;

  if existing_session_id is not null
     and existing_plan_id = owning_plan
     and existing_plan_status = 'active' then
    return existing_session_id;
  end if;

  if existing_session_id is not null then
    update public.workout_sessions
    set status = 'cancelled',
      completed_at = null,
      duration_seconds = greatest(
        0,
        extract(epoch from (now() - started_at))::integer
      ),
      cancellation_reason =
        'Sessão antiga descartada após ativação de novo plano',
      updated_at = now()
    where id = existing_session_id
      and user_id = current_user_id
      and status = 'in_progress';
    if not found then
      raise exception 'Sessão antiga não pôde ser descartada';
    end if;
  end if;

  select count(distinct item.exercise_id),
    count(distinct item.exercise_id) filter (
      where public.exercise_has_approved_primary(item.exercise_id)
    )
  into total_exercises, media_ready_exercises
  from public.workout_days day
  join public.workout_day_exercises item on item.workout_day_id = day.id
  where day.workout_plan_id = owning_plan;

  if total_exercises = 0 or media_ready_exercises <> total_exercises then
    raise exception
      'Plano ativo indisponível: cobertura visual incompleta (%/% prontos)',
      media_ready_exercises, total_exercises;
  end if;

  insert into public.workout_sessions(user_id, workout_day_id, workout_plan_id)
  values(current_user_id, p_workout_day_id, owning_plan)
  returning id into new_session;

  insert into public.workout_session_exercises(
    workout_session_id, planned_exercise_id, actual_exercise_id, position
  )
  select new_session, item.exercise_id, item.exercise_id, item.position
  from public.workout_day_exercises item
  where item.workout_day_id = p_workout_day_id
  order by item.position;

  insert into public.set_logs(user_id, session_exercise_id, set_number)
  select current_user_id, session_exercise.id, number
  from public.workout_session_exercises session_exercise
  join public.workout_day_exercises planned
    on planned.workout_day_id = p_workout_day_id
    and planned.exercise_id = session_exercise.planned_exercise_id
    and planned.position = session_exercise.position
  cross join lateral generate_series(1, planned.target_sets) number
  where session_exercise.workout_session_id = new_session;

  return new_session;
end;
$$;
revoke all on function public.start_workout(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.start_workout(uuid) to authenticated;

comment on function public.get_plan_replacement_candidates_v214(uuid,text,integer,integer,text)
  is 'v2.1.4 goal-aware plan alternatives classified by the backend without exposing rank scores.';
comment on function public.get_workout_replacement_candidates_v214(uuid,text,uuid,text,integer,integer)
  is 'v2.1.4 session-only direct and goal-aligned alternatives; never performs weekly rebalance.';
comment on function public.start_workout(uuid)
  is 'Resumes only the current active plan; atomically cancels a stale archived-plan session before starting the latest plan snapshot.';

commit;
