create or replace function public.enforce_server_media_approval() returns trigger
language plpgsql set search_path='' as $$
begin
  if old.status <> 'approved' and new.status='approved'
     and coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'Aprovação deve ocorrer exclusivamente no servidor';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_server_media_approval_before_write on public.exercise_media;
create trigger enforce_server_media_approval_before_write
before update on public.exercise_media for each row
execute function public.enforce_server_media_approval();
