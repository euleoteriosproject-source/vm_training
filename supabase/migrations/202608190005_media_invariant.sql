create or replace function public.protect_active_exercise_media() returns trigger
language plpgsql set search_path = '' as $$
declare affected_exercise uuid;
begin
  if tg_op = 'DELETE' then affected_exercise := old.exercise_id;
  else affected_exercise := new.exercise_id;
  end if;
  if exists(select 1 from public.exercises where id=affected_exercise and active)
     and not exists(
       select 1 from public.exercise_media
       where exercise_id=affected_exercise and status='approved' and media_type in ('video','gif')
     ) then
    raise exception 'Não é possível remover a última mídia aprovada de um exercício ativo';
  end if;
  if tg_op = 'DELETE' then return old;
  else return new;
  end if;
end;
$$;

create constraint trigger active_exercise_keeps_media
after delete or update on public.exercise_media
deferrable initially deferred for each row execute function public.protect_active_exercise_media();
