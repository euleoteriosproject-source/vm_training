-- VM Training v2.0: self-service account deletion without a privileged key
-- in the web runtime. The public RPC remains SECURITY INVOKER and delegates
-- the narrowly scoped auth.users delete to a private, non-exposed helper.

create or replace function private.delete_current_auth_user()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null or auth.role() is distinct from 'authenticated' then
    raise exception 'Não autenticado';
  end if;

  delete from auth.users where id = current_user_id;
  if not found then
    raise exception 'Usuário não encontrado';
  end if;
end;
$$;

create or replace function public.delete_own_account_data()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;
  perform private.delete_current_auth_user();
end;
$$;

revoke all on function private.delete_current_auth_user()
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function private.delete_current_auth_user() to authenticated;

revoke all on function public.delete_own_account_data()
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.delete_own_account_data() to authenticated;

comment on function public.delete_own_account_data() is
  'Deletes only auth.uid() and its cascade-owned application data.';
