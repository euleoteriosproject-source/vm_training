create or replace function public.owns_session(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.workout_sessions where id=p_id and user_id=auth.uid());
$$;
drop policy if exists "own session exercises" on public.workout_session_exercises;
create policy "own session exercises" on public.workout_session_exercises for all to authenticated
using(public.owns_session(workout_session_id)) with check(public.owns_session(workout_session_id));
