-- VM Training Media Operations v1.3

alter table public.exercise_media drop constraint if exists exercise_media_status_check;
alter table public.exercise_media drop constraint if exists exercise_media_execution_quality_check;

alter table public.exercise_media add column if not exists media_role text;
alter table public.exercise_media add column if not exists review_checklist jsonb not null default '{}'::jsonb;
alter table public.exercise_media add column if not exists rejection_reason text;
alter table public.exercise_media add column if not exists reviewed_by uuid references public.profiles(user_id) on delete set null;
alter table public.exercise_media add column if not exists reviewed_at timestamptz;
alter table public.exercise_media add column if not exists approved_by uuid references public.profiles(user_id) on delete set null;
alter table public.exercise_media add column if not exists approved_at timestamptz;
alter table public.exercise_media add column if not exists poster_timestamp numeric;
alter table public.exercise_media add column if not exists processing_error text;
alter table public.exercise_media add column if not exists processing_log jsonb not null default '[]'::jsonb;
alter table public.exercise_media add column if not exists processing_started_at timestamptz;
alter table public.exercise_media add column if not exists processed_at timestamptz;
alter table public.exercise_media add column if not exists ready_for_processing boolean not null default false;

alter table public.exercise_media alter column execution_quality set default 'unreviewed';
alter table public.exercise_media add constraint exercise_media_status_check
  check(status in ('pending','reviewing','processing','processed','approved','rejected','failed'));
alter table public.exercise_media add constraint exercise_media_execution_quality_check
  check(execution_quality in ('unreviewed','approved','acceptable','rejected'));
alter table public.exercise_media add constraint exercise_media_role_check
  check(media_role is null or media_role in ('PRIMARY_DEMO','EDUCATIONAL','ALTERNATIVE_VARIATION'));
alter table public.exercise_media add constraint exercise_media_rejection_reason_check
  check(rejection_reason is null or rejection_reason in (
    'wrong_exercise','wrong_equipment','poor_execution','poor_visibility',
    'incomplete_movement','license_issue','low_quality','duplicate','other'
  ));
alter table public.exercise_media add constraint exercise_media_poster_timestamp_check
  check(poster_timestamp is null or poster_timestamp >= 0);

drop index if exists public.exercise_media_one_primary;
create unique index exercise_media_one_approved_primary
  on public.exercise_media(exercise_id)
  where media_role='PRIMARY_DEMO' and status='approved' and is_primary=true;

create table if not exists public.media_review_events (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.exercise_media(id) on delete cascade,
  admin_user_id uuid references public.profiles(user_id) on delete set null,
  action text not null check(action in (
    'candidate_created','review_started','classified_primary','classified_educational',
    'classified_variation','rejected','processing_started','processing_failed',
    'processed','approved'
  )),
  from_status text,
  to_status text not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists media_review_events_media_created_idx
  on public.media_review_events(media_id,created_at desc);
alter table public.media_review_events enable row level security;
create policy "admins read media events" on public.media_review_events
  for select to authenticated using(public.is_admin());
create policy "admins write media events" on public.media_review_events
  for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select on public.media_review_events to authenticated;

create or replace function public.is_valid_primary_checklist(value jsonb) returns boolean
language sql immutable set search_path='' as $$
  select coalesce((value->>'correct_exercise')::boolean,false)
     and coalesce((value->>'compatible_equipment')::boolean,false)
     and coalesce((value->>'start_position_visible')::boolean,false)
     and coalesce((value->>'main_range_visible')::boolean,false)
     and coalesce((value->>'complete_repetition_visible')::boolean,false)
     and coalesce((value->>'technically_acceptable')::boolean,false)
     and coalesce((value->>'sufficient_clarity')::boolean,false)
     and coalesce((value->>'useful_framing')::boolean,false)
     and coalesce((value->>'no_blocking_elements')::boolean,false)
     and coalesce((value->>'license_confirmed')::boolean,false);
$$;

create or replace function public.exercise_has_approved_primary(p_exercise_id uuid) returns boolean
language sql stable set search_path='' as $$
  select exists(
    select 1 from public.exercise_media media
    where media.exercise_id=p_exercise_id
      and media.status='approved'
      and media.execution_quality='approved'
      and media.media_role='PRIMARY_DEMO'
      and media.is_primary=true
  );
$$;

create or replace function public.get_exercise_publish_readiness(p_exercise_id uuid) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object(
    'hasApprovedPrimaryMedia', public.exercise_has_approved_primary(exercise.id),
    'hasInstructions', coalesce(cardinality(exercise.execution_instructions),0) > 0,
    'hasEquipment', exists(select 1 from public.exercise_equipment link where link.exercise_id=exercise.id),
    'hasMovementPattern', nullif(btrim(exercise.movement_pattern),'') is not null,
    'hasPrimaryMuscles', coalesce(cardinality(exercise.primary_muscles),0) > 0,
    'active', exercise.active
  )
  from public.exercises exercise where exercise.id=p_exercise_id;
$$;

create or replace function public.validate_media_approval() returns trigger
language plpgsql set search_path='' as $$
declare
  valid_transition boolean;
begin
  if tg_op='UPDATE' and old.status <> new.status then
    valid_transition := case old.status
      when 'pending' then new.status in ('reviewing','rejected')
      when 'reviewing' then new.status in ('processing','rejected')
      when 'processing' then new.status in ('processed','failed')
      when 'failed' then new.status in ('processing','rejected')
      when 'processed' then new.status in ('approved','rejected','processing')
      when 'approved' then new.status in ('rejected','reviewing')
      when 'rejected' then new.status='reviewing'
      else false
    end;
    if not valid_transition then
      raise exception 'Transição de mídia inválida: % -> %', old.status, new.status;
    end if;
  end if;

  if new.status='approved' then
    if new.storage_path is null or new.poster_path is null or new.content_hash is null
       or new.source_url is null or new.source_name is null or new.source_type is null or new.license_code is null
       or new.author is null or new.attribution_text is null or new.reviewed_at is null
       or new.reviewed_by is null or new.approved_at is null or new.approved_by is null
       or new.processed_at is null or new.execution_quality <> 'approved' or new.media_role is null then
      raise exception 'Mídia aprovada requer processamento, origem, licença, revisão, papel e qualidade aprovados';
    end if;
    if new.attribution_required and (new.author is null or new.attribution_text is null or new.license_url is null) then
      raise exception 'Licença com atribuição requer autor, texto e URL da licença';
    end if;
    if new.media_role='PRIMARY_DEMO' and not public.is_valid_primary_checklist(new.review_checklist) then
      raise exception 'Demonstração principal requer checklist completo';
    end if;
  end if;

  if new.is_primary and (
    new.status <> 'approved' or new.execution_quality <> 'approved'
    or new.media_role is distinct from 'PRIMARY_DEMO'
  ) then
    raise exception 'Somente PRIMARY_DEMO aprovada pode ser principal';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_exercise_media() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.active and not public.exercise_has_approved_primary(new.id) then
    raise exception 'Exercício ativo requer PRIMARY_DEMO aprovada';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_primary_media_regression() returns trigger
language plpgsql set search_path='' as $$
begin
  if old.status='approved' and old.media_role='PRIMARY_DEMO' and old.is_primary
     and (new.status <> 'approved' or new.media_role is distinct from 'PRIMARY_DEMO' or not new.is_primary)
     and exists(select 1 from public.exercises exercise where exercise.id=old.exercise_id and exercise.active) then
    raise exception 'Desative o exercício antes de remover sua PRIMARY_DEMO';
  end if;
  return new;
end;
$$;
drop trigger if exists prevent_primary_media_regression_before_write on public.exercise_media;
create trigger prevent_primary_media_regression_before_write
before update on public.exercise_media for each row execute function public.prevent_primary_media_regression();

drop policy if exists "approved media read" on public.exercise_media;
create policy "approved media read" on public.exercise_media for select to authenticated
using(
  (status='approved' and execution_quality='approved' and media_role is not null)
  or public.is_admin()
);

drop policy if exists "approved exercise media files read" on storage.objects;
create policy "approved exercise media files read" on storage.objects for select to authenticated
using(
  bucket_id='exercise-media' and (
    public.is_admin() or exists(
      select 1 from public.exercise_media media
      where media.status='approved'
        and media.execution_quality='approved'
        and media.media_role is not null
        and (media.storage_path=storage.objects.name or media.poster_path=storage.objects.name)
    )
  )
);

update public.exercise_media
set execution_quality = 'unreviewed'
where status in ('pending','reviewing') and execution_quality = 'acceptable';
