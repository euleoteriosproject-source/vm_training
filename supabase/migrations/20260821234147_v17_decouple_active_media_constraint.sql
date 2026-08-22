-- Finish v1.7 catalog/media decoupling. The original deferred constraint
-- blocked publishing the first approved media after catalog activation.
drop trigger if exists active_exercise_keeps_media on public.exercise_media;

create or replace function public.protect_active_exercise_media()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.protect_active_exercise_media()
  from public, anon, authenticated, service_role, supabase_auth_admin;
