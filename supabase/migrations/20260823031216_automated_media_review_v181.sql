-- VM Training v1.8.1 - explicit automated review provenance and a publisher
-- that is intentionally unavailable through the Data API.

alter table public.exercise_media
  add column if not exists review_state text,
  add column if not exists review_method text,
  add column if not exists review_agent text,
  add column if not exists validation_version text,
  add column if not exists validation_confidence text,
  add column if not exists automated_validation jsonb not null default '{}'::jsonb;

update public.exercise_media
set review_state = case status
  when 'approved' then 'PUBLISHED'
  when 'rejected' then 'REJECTED'
  else 'MANUAL_REVIEW_REQUIRED'
end
where review_state is null;

update public.exercise_media
set review_method = 'human'
where review_method is null and reviewed_by is not null;

alter table public.exercise_media
  alter column review_state set default 'MANUAL_REVIEW_REQUIRED',
  alter column review_state set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'exercise_media_review_state_check'
      and conrelid = 'public.exercise_media'::regclass
  ) then
    alter table public.exercise_media add constraint exercise_media_review_state_check
      check (review_state in (
        'AUTOMATED_VALIDATED',
        'MANUAL_REVIEW_REQUIRED',
        'REJECTED',
        'PUBLISHED'
      ));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'exercise_media_review_method_check'
      and conrelid = 'public.exercise_media'::regclass
  ) then
    alter table public.exercise_media add constraint exercise_media_review_method_check
      check (review_method is null or review_method in ('automated', 'human'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'exercise_media_validation_confidence_check'
      and conrelid = 'public.exercise_media'::regclass
  ) then
    alter table public.exercise_media add constraint exercise_media_validation_confidence_check
      check (validation_confidence is null or validation_confidence in ('HIGH', 'MEDIUM', 'LOW'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'exercise_media_automated_provenance_check'
      and conrelid = 'public.exercise_media'::regclass
  ) then
    alter table public.exercise_media add constraint exercise_media_automated_provenance_check
      check (
        review_method is distinct from 'automated'
        or (
          reviewed_by is null
          and reviewed_at is not null
          and nullif(btrim(review_agent), '') is not null
          and nullif(btrim(validation_version), '') is not null
        )
      );
  end if;
end $$;

create index if not exists exercise_media_manual_review_queue_idx
  on public.exercise_media(created_at desc)
  where review_state = 'MANUAL_REVIEW_REQUIRED';

alter table public.media_review_events
  drop constraint if exists media_review_events_action_check;
alter table public.media_review_events
  add constraint media_review_events_action_check check(action in (
    'candidate_created',
    'discovered',
    'review_started',
    'classified_primary',
    'classified_educational',
    'classified_variation',
    'automated_validated',
    'manual_review_required',
    'rejected',
    'processing_started',
    'processing_failed',
    'processed',
    'approved',
    'automated_published'
  ));

create or replace function private.is_valid_automated_media_validation(value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce((value ->> 'exercise_match_exact')::boolean, false)
     and coalesce((value ->> 'equipment_match')::boolean, false)
     and coalesce((value ->> 'execution_quality_approved')::boolean, false)
     and coalesce((value ->> 'visibility_sufficient')::boolean, false)
     and coalesce((value ->> 'license_verified')::boolean, false)
     and coalesce((value ->> 'download_permitted')::boolean, false)
     and coalesce((value ->> 'transformation_permitted')::boolean, false)
     and coalesce((value ->> 'rehost_permitted')::boolean, false)
     and coalesce((value ->> 'source_provenance_verified')::boolean, false)
     and coalesce((value ->> 'visual_inspection_passed')::boolean, false)
     and coalesce((value ->> 'biomechanical_references_passed')::boolean, false)
     and coalesce((value ->> 'final_gif_inspection_passed')::boolean, false)
     and coalesce((value ->> 'storage_hash_verified')::boolean, false);
$$;

create or replace function public.validate_media_approval() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  valid_transition boolean;
begin
  if tg_op = 'UPDATE' and old.status <> new.status then
    valid_transition := case old.status
      when 'pending' then new.status in ('reviewing', 'rejected')
      when 'reviewing' then new.status in ('processing', 'rejected')
      when 'processing' then new.status in ('processed', 'failed')
      when 'failed' then new.status in ('processing', 'rejected')
      when 'processed' then new.status in ('approved', 'rejected', 'processing')
      when 'approved' then new.status in ('rejected', 'reviewing')
      when 'rejected' then new.status = 'reviewing'
      else false
    end;
    if not valid_transition then
      raise exception 'Transicao de midia invalida: % -> %', old.status, new.status;
    end if;
  end if;

  if new.status = 'rejected' then
    new.review_state := 'REJECTED';
  end if;

  if new.status = 'approved' then
    if new.storage_path is null or new.poster_path is null or new.content_hash is null
       or new.source_url is null or new.source_name is null or new.source_type is null
       or new.license_code is null
       or new.author is null or new.attribution_text is null or new.reviewed_at is null
       or new.approved_at is null or new.processed_at is null
       or new.execution_quality <> 'approved' or new.media_role is null
       or new.review_state <> 'PUBLISHED' then
      raise exception 'Midia aprovada requer processamento, origem, licenca, revisao, papel e qualidade aprovados';
    end if;
    if new.review_method = 'human' then
      if new.reviewed_by is null or new.approved_by is null then
        raise exception 'Publicacao humana requer revisor e aprovador humanos';
      end if;
    elsif new.review_method = 'automated' then
      if new.reviewed_by is not null or new.approved_by is not null
         or new.validation_confidence <> 'HIGH'
         or new.original_file_url is null
         or new.verified_at is null
         or nullif(btrim(new.review_agent), '') is null
         or nullif(btrim(new.validation_version), '') is null
         or not private.is_valid_automated_media_validation(new.automated_validation) then
        raise exception 'Publicacao automatizada requer proveniencia, confianca HIGH e todos os checks';
      end if;
    else
      raise exception 'Midia aprovada requer metodo de revisao explicito';
    end if;
    if new.attribution_required
       and (new.author is null or new.attribution_text is null or new.license_url is null) then
      raise exception 'Licenca com atribuicao requer autor, texto e URL da licenca';
    end if;
    if new.media_role = 'PRIMARY_DEMO' then
      if not public.is_valid_primary_checklist(new.review_checklist) then
        raise exception 'Demonstracao principal requer checklist completo';
      end if;
      if not public.is_valid_animated_primary(new) then
        raise exception 'PRIMARY_DEMO requer GIF animado verificado ou fallback MP4 documentado';
      end if;
    end if;
  end if;

  if new.is_primary and (
    new.status <> 'approved'
    or new.execution_quality <> 'approved'
    or new.media_role is distinct from 'PRIMARY_DEMO'
    or new.review_state <> 'PUBLISHED'
    or not public.is_valid_animated_primary(new)
  ) then
    raise exception 'Somente PRIMARY_DEMO animada e publicada pode ser principal';
  end if;
  return new;
end;
$$;

create or replace function public.publish_exercise_media(p_media_id uuid, p_admin_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate public.exercise_media%rowtype;
begin
  if not exists(
    select 1 from public.profiles profile
    where profile.user_id = p_admin_id and profile.role = 'admin'
  ) then
    raise exception 'Apenas administradores podem publicar midia';
  end if;

  select * into candidate from public.exercise_media media
  where media.id = p_media_id for update;
  if not found then raise exception 'Midia nao encontrada'; end if;
  if candidate.status <> 'processed' then
    raise exception 'Somente midia processada pode ser publicada';
  end if;
  if candidate.media_role is null then
    raise exception 'Classifique a midia antes de publicar';
  end if;
  if candidate.reviewed_by is null or candidate.reviewed_at is null then
    raise exception 'Publicacao humana requer revisao humana registrada';
  end if;

  if candidate.media_role = 'PRIMARY_DEMO' then
    update public.exercise_media set
      status = 'reviewing',
      review_state = 'MANUAL_REVIEW_REQUIRED',
      is_primary = false,
      updated_at = now()
    where exercise_id = candidate.exercise_id and id <> candidate.id
      and status = 'approved' and media_role = 'PRIMARY_DEMO' and is_primary = true;
  end if;

  update public.exercise_media set
    status = 'approved',
    review_state = 'PUBLISHED',
    review_method = 'human',
    review_agent = null,
    validation_version = null,
    validation_confidence = null,
    automated_validation = '{}'::jsonb,
    execution_quality = 'approved',
    is_primary = (media_role = 'PRIMARY_DEMO'),
    approved_by = p_admin_id,
    approved_at = now(),
    processing_error = null,
    updated_at = now()
  where id = candidate.id;

  insert into public.media_review_events(
    media_id, admin_user_id, action, from_status, to_status,
    metadata
  ) values(
    candidate.id, p_admin_id, 'approved', 'processed', 'approved',
    jsonb_build_object('review_method', 'human')
  );

  return public.get_exercise_publish_readiness(candidate.exercise_id);
end;
$$;

create or replace function private.publish_validated_exercise_media_automated(
  p_media_id uuid,
  p_review_agent text,
  p_validation_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate public.exercise_media%rowtype;
begin
  select * into candidate from public.exercise_media media
  where media.id = p_media_id for update;
  if not found then raise exception 'Midia nao encontrada'; end if;
  if candidate.status <> 'processed'
     or candidate.review_state <> 'AUTOMATED_VALIDATED'
     or candidate.review_method <> 'automated'
     or candidate.reviewed_by is not null
     or candidate.validation_confidence <> 'HIGH'
     or candidate.review_agent is distinct from p_review_agent
     or candidate.validation_version is distinct from p_validation_version
     or not private.is_valid_automated_media_validation(candidate.automated_validation) then
    raise exception 'Candidato nao satisfaz o gate de publicacao automatizada';
  end if;
  if candidate.media_role is null then
    raise exception 'Classifique a midia antes de publicar';
  end if;

  if candidate.media_role = 'PRIMARY_DEMO' then
    update public.exercise_media set
      status = 'reviewing',
      review_state = 'MANUAL_REVIEW_REQUIRED',
      is_primary = false,
      updated_at = now()
    where exercise_id = candidate.exercise_id and id <> candidate.id
      and status = 'approved' and media_role = 'PRIMARY_DEMO' and is_primary = true;
  end if;

  update public.exercise_media set
    status = 'approved',
    review_state = 'PUBLISHED',
    execution_quality = 'approved',
    is_primary = (media_role = 'PRIMARY_DEMO'),
    approved_by = null,
    approved_at = now(),
    processing_error = null,
    updated_at = now()
  where id = candidate.id;

  insert into public.media_review_events(
    media_id, admin_user_id, action, from_status, to_status, metadata
  ) values(
    candidate.id,
    null,
    'automated_published',
    'processed',
    'approved',
    jsonb_build_object(
      'review_method', 'automated',
      'review_agent', p_review_agent,
      'validation_version', p_validation_version,
      'confidence', candidate.validation_confidence,
      'content_hash', candidate.content_hash,
      'checks', candidate.automated_validation
    )
  );

  return public.get_exercise_publish_readiness(candidate.exercise_id);
end;
$$;

revoke all on function private.is_valid_automated_media_validation(jsonb)
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function private.publish_validated_exercise_media_automated(uuid, text, text)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant usage on schema private to service_role;
grant execute on function private.publish_validated_exercise_media_automated(uuid, text, text)
  to service_role;

revoke all on function public.publish_exercise_media(uuid, uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.publish_exercise_media(uuid, uuid) to service_role;
revoke all on function public.validate_media_approval()
  from public, anon, authenticated, service_role, supabase_auth_admin;
