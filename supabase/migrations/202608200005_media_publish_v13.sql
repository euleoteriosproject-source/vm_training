create or replace function public.publish_exercise_media(p_media_id uuid, p_admin_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  candidate public.exercise_media%rowtype;
  readiness jsonb;
begin
  if not exists(
    select 1 from public.profiles profile
    where profile.user_id=p_admin_id and profile.role='admin'
  ) then
    raise exception 'Apenas administradores podem publicar mídia';
  end if;

  select * into candidate
  from public.exercise_media media
  where media.id=p_media_id
  for update;
  if not found then raise exception 'Mídia não encontrada'; end if;
  if candidate.status <> 'processed' then
    raise exception 'Somente mídia processada pode ser publicada';
  end if;
  if candidate.media_role is null then raise exception 'Classifique a mídia antes de publicar'; end if;

  if candidate.media_role='PRIMARY_DEMO' then
    update public.exercises set active=false where id=candidate.exercise_id and active=true;
    update public.exercise_media
    set status='reviewing', is_primary=false, updated_at=now()
    where exercise_id=candidate.exercise_id
      and id<>candidate.id
      and status='approved'
      and media_role='PRIMARY_DEMO'
      and is_primary=true;
  end if;

  update public.exercise_media
  set status='approved',
      execution_quality='approved',
      is_primary=(media_role='PRIMARY_DEMO'),
      approved_by=p_admin_id,
      approved_at=now(),
      processing_error=null,
      updated_at=now()
  where id=candidate.id;

  if candidate.media_role='PRIMARY_DEMO' then
    readiness := public.get_exercise_publish_readiness(candidate.exercise_id);
    if coalesce((readiness->>'hasApprovedPrimaryMedia')::boolean,false)
       and coalesce((readiness->>'hasInstructions')::boolean,false)
       and coalesce((readiness->>'hasEquipment')::boolean,false)
       and coalesce((readiness->>'hasMovementPattern')::boolean,false)
       and coalesce((readiness->>'hasPrimaryMuscles')::boolean,false) then
      update public.exercises set active=true where id=candidate.exercise_id;
    end if;
  end if;

  insert into public.media_review_events(
    media_id,admin_user_id,action,from_status,to_status
  ) values(candidate.id,p_admin_id,'approved','processed','approved');

  return public.get_exercise_publish_readiness(candidate.exercise_id);
end;
$$;

revoke all on function public.publish_exercise_media(uuid,uuid) from public, anon, authenticated;
grant execute on function public.publish_exercise_media(uuid,uuid) to service_role;
