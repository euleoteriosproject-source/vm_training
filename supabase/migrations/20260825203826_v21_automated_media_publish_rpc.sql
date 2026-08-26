-- VM Training v2.1: narrowly scoped operational publication endpoint.
-- It is not callable by browser roles and never attributes automation to a
-- human reviewer. Storage bytes and hashes are verified by the caller before
-- this final database transition.

begin;

create or replace function public.publish_v21_automated_media(
  p_media_id uuid,
  p_expected_content_hash text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate public.exercise_media%rowtype;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Operação exclusiva do serviço';
  end if;
  if p_media_id is null
     or p_expected_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Identidade de mídia v2.1 inválida';
  end if;

  select *
  into strict candidate
  from public.exercise_media media
  where media.id = p_media_id
  for update;

  if candidate.content_hash <> p_expected_content_hash
     or candidate.storage_path is null
     or candidate.poster_path is null
     or candidate.review_method <> 'automated'
     or candidate.review_agent <> 'vm-media-validator-v21'
     or candidate.validation_version <> '2.1'
     or candidate.validation_confidence <> 'HIGH'
     or candidate.reviewed_by is not null
     or candidate.approved_by is not null
     or candidate.media_role <> 'PRIMARY_DEMO'
     or not private.is_valid_automated_media_validation(candidate.automated_validation)
     or not exists (
       select 1 from storage.objects object
       where object.bucket_id = 'exercise-media'
         and object.name = candidate.storage_path
     )
     or not exists (
       select 1 from storage.objects object
       where object.bucket_id = 'exercise-media'
         and object.name = candidate.poster_path
     ) then
    raise exception 'Gate de publicação v2.1 falhou';
  end if;

  if candidate.status = 'approved' then
    if candidate.review_state <> 'PUBLISHED' or not candidate.is_primary then
      raise exception 'Mídia v2.1 aprovada diverge do estado publicado';
    end if;
    return;
  end if;
  if candidate.status <> 'processed'
     or candidate.review_state <> 'AUTOMATED_VALIDATED' then
    raise exception 'Mídia v2.1 ainda não está processada';
  end if;

  perform private.publish_validated_exercise_media_automated(
    candidate.id,
    'vm-media-validator-v21',
    '2.1'
  );
end;
$$;

revoke all on function public.publish_v21_automated_media(uuid, text)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.publish_v21_automated_media(uuid, text)
  to service_role;

comment on function public.publish_v21_automated_media(uuid, text) is
  'Service-only, hash-bound publication of fully validated v2.1 automated media.';

commit;
