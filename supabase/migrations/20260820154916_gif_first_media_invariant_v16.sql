-- VM Training Media Processing v1.6 - GIF-FIRST

alter table public.exercise_media add column if not exists animation_verified boolean not null default false;
alter table public.exercise_media add column if not exists frame_count integer;
alter table public.exercise_media add column if not exists animation_loop boolean;
alter table public.exercise_media add column if not exists frames_per_second numeric;
alter table public.exercise_media add column if not exists fallback_reason text;

alter table public.exercise_media add constraint exercise_media_frame_count_check
  check(frame_count is null or frame_count > 0);
alter table public.exercise_media add constraint exercise_media_fps_check
  check(frames_per_second is null or frames_per_second > 0);
alter table public.exercise_media add constraint exercise_media_fallback_reason_check
  check(fallback_reason is null or fallback_reason in (
    'GIF_SIZE_TOO_LARGE','GIF_QUALITY_INSUFFICIENT','GIF_MOTION_DEGRADED','GIF_PROCESSING_FAILED'
  ));

create or replace function public.is_valid_animated_primary(media public.exercise_media) returns boolean
language sql immutable set search_path='' as $$
  select case media.media_type
    when 'gif' then media.animation_verified
      and coalesce(media.frame_count,0) > 1
      and coalesce(media.duration_seconds,0) > 0
      and media.animation_loop is true
      and media.fallback_reason is null
    when 'video' then media.animation_verified
      and coalesce(media.duration_seconds,0) > 0
      and media.fallback_reason in (
        'GIF_SIZE_TOO_LARGE','GIF_QUALITY_INSUFFICIENT','GIF_MOTION_DEGRADED','GIF_PROCESSING_FAILED'
      )
    else false
  end;
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
      and public.is_valid_animated_primary(media)
  );
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
      raise exception 'Transicao de midia invalida: % -> %', old.status, new.status;
    end if;
  end if;

  if new.status='approved' then
    if new.storage_path is null or new.poster_path is null or new.content_hash is null
       or new.source_url is null or new.source_name is null or new.source_type is null or new.license_code is null
       or new.author is null or new.attribution_text is null or new.reviewed_at is null
       or new.reviewed_by is null or new.approved_at is null or new.approved_by is null
       or new.processed_at is null or new.execution_quality <> 'approved' or new.media_role is null then
      raise exception 'Midia aprovada requer processamento, origem, licenca, revisao, papel e qualidade aprovados';
    end if;
    if new.attribution_required and (new.author is null or new.attribution_text is null or new.license_url is null) then
      raise exception 'Licenca com atribuicao requer autor, texto e URL da licenca';
    end if;
    if new.media_role='PRIMARY_DEMO' then
      if not public.is_valid_primary_checklist(new.review_checklist) then
        raise exception 'Demonstracao principal requer checklist completo';
      end if;
      if not public.is_valid_animated_primary(new) then
        raise exception 'PRIMARY_DEMO requer GIF animado verificado ou fallback MP4 documentado';
      end if;
    end if;
  end if;

  if new.is_primary and (
    new.status <> 'approved' or new.execution_quality <> 'approved'
    or new.media_role is distinct from 'PRIMARY_DEMO'
    or not public.is_valid_animated_primary(new)
  ) then
    raise exception 'Somente PRIMARY_DEMO animada e aprovada pode ser principal';
  end if;
  return new;
end;
$$;

revoke all on function public.is_valid_animated_primary(public.exercise_media)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.is_valid_animated_primary(public.exercise_media)
  to authenticated, service_role;
