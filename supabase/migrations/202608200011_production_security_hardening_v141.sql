-- VM Training v1.4.1: reduce the Data API attack surface without changing
-- application semantics. The private schema is intentionally absent from the
-- PostgREST exposed schemas configured in supabase/config.toml.

create schema if not exists private;
revoke all on schema private from public, anon, service_role, supabase_auth_admin;
grant usage on schema private to authenticated;

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1
    from public.profiles
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function private.owns_plan(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1
    from public.workout_plans
    where id = p_id and user_id = (select auth.uid())
  );
$$;

create or replace function private.owns_day(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1
    from public.workout_days day
    join public.workout_plans plan on plan.id = day.workout_plan_id
    where day.id = p_id and plan.user_id = (select auth.uid())
  );
$$;

create or replace function private.owns_session(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1
    from public.workout_sessions
    where id = p_id and user_id = (select auth.uid())
  );
$$;

create or replace function private.owns_session_exercise(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1
    from public.workout_session_exercises session_exercise
    join public.workout_sessions session
      on session.id = session_exercise.workout_session_id
    where session_exercise.id = p_id
      and session.user_id = (select auth.uid())
  );
$$;

revoke all on all functions in schema private
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.owns_plan(uuid) to authenticated;
grant execute on function private.owns_day(uuid) to authenticated;
grant execute on function private.owns_session(uuid) to authenticated;
grant execute on function private.owns_session_exercise(uuid) to authenticated;

-- RLS helpers now live outside the schemas exposed by PostgREST.
alter policy "admin manages invitations" on public.allowed_signup_emails
  using (private.is_admin()) with check (private.is_admin());

alter policy "approved media read" on public.exercise_media
  using (
    (status = 'approved' and execution_quality = 'approved' and media_role is not null)
    or private.is_admin()
  );

alter policy "licenses readable" on public.media_licenses
  using (active or private.is_admin());

alter policy "admins read media events" on public.media_review_events
  using (private.is_admin());

alter policy "own days" on public.workout_days
  using (private.owns_plan(workout_plan_id))
  with check (private.owns_plan(workout_plan_id));

alter policy "own planned exercises" on public.workout_day_exercises
  using (private.owns_day(workout_day_id))
  with check (private.owns_day(workout_day_id));

alter policy "own session exercises" on public.workout_session_exercises
  using (private.owns_session(workout_session_id))
  with check (private.owns_session(workout_session_id));

alter policy "own sets" on public.set_logs
  using (
    user_id = (select auth.uid())
    and private.owns_session_exercise(session_exercise_id)
  )
  with check (
    user_id = (select auth.uid())
    and private.owns_session_exercise(session_exercise_id)
  );

alter policy "own cardio" on public.cardio_logs
  using (
    user_id = (select auth.uid())
    and private.owns_session_exercise(session_exercise_id)
  )
  with check (
    user_id = (select auth.uid())
    and private.owns_session_exercise(session_exercise_id)
  );

alter policy "admin uploads exercise media" on storage.objects
  with check (bucket_id = 'exercise-media' and private.is_admin());
alter policy "admin updates exercise media" on storage.objects
  using (bucket_id = 'exercise-media' and private.is_admin())
  with check (bucket_id = 'exercise-media' and private.is_admin());
alter policy "admin deletes exercise media" on storage.objects
  using (bucket_id = 'exercise-media' and private.is_admin());
alter policy "approved exercise media files read" on storage.objects
  using (
    bucket_id = 'exercise-media' and (
      private.is_admin() or exists(
        select 1
        from public.exercise_media media
        where media.status = 'approved'
          and media.execution_quality = 'approved'
          and media.media_role is not null
          and (
            media.storage_path = storage.objects.name
            or media.poster_path = storage.objects.name
          )
      )
    )
  );

-- Cache auth.uid() once per statement instead of evaluating it for every row.
alter policy "own profile read" on public.profiles
  using (user_id = (select auth.uid()));
alter policy "own profile update" on public.profiles
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
alter policy "own training preferences" on public.training_preferences
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
alter policy "own goals" on public.user_goals
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
alter policy "own equipment" on public.user_equipment
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
alter policy "own exercise preferences" on public.user_exercise_preferences
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
alter policy "own measurements" on public.body_measurements
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
alter policy "own plans" on public.workout_plans
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
alter policy "own sessions" on public.workout_sessions
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- FOR ALL policies overlapped the read policies. Splitting write operations
-- preserves the same authorization while removing duplicate permissive SELECT
-- policies reported by the advisor.
drop policy if exists "admin equipment write" on public.equipment;
create policy "admin equipment insert" on public.equipment
  for insert to authenticated with check (private.is_admin());
create policy "admin equipment update" on public.equipment
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admin equipment delete" on public.equipment
  for delete to authenticated using (private.is_admin());

drop policy if exists "admin exercises write" on public.exercises;
create policy "admin exercises insert" on public.exercises
  for insert to authenticated with check (private.is_admin());
create policy "admin exercises update" on public.exercises
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admin exercises delete" on public.exercises
  for delete to authenticated using (private.is_admin());

drop policy if exists "admin exercise equipment write" on public.exercise_equipment;
create policy "admin exercise equipment insert" on public.exercise_equipment
  for insert to authenticated with check (private.is_admin());
create policy "admin exercise equipment update" on public.exercise_equipment
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admin exercise equipment delete" on public.exercise_equipment
  for delete to authenticated using (private.is_admin());

drop policy if exists "admin media write" on public.exercise_media;
create policy "admin media insert" on public.exercise_media
  for insert to authenticated with check (private.is_admin());
create policy "admin media update" on public.exercise_media
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admin media delete" on public.exercise_media
  for delete to authenticated using (private.is_admin());

drop policy if exists "admin substitutions write" on public.exercise_substitutions;
create policy "admin substitutions insert" on public.exercise_substitutions
  for insert to authenticated with check (private.is_admin());
create policy "admin substitutions update" on public.exercise_substitutions
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admin substitutions delete" on public.exercise_substitutions
  for delete to authenticated using (private.is_admin());

drop policy if exists "aliases admin write" on public.exercise_aliases;
create policy "aliases admin insert" on public.exercise_aliases
  for insert to authenticated with check (private.is_admin());
create policy "aliases admin update" on public.exercise_aliases
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "aliases admin delete" on public.exercise_aliases
  for delete to authenticated using (private.is_admin());

drop policy if exists "licenses admin write" on public.media_licenses;
create policy "licenses admin insert" on public.media_licenses
  for insert to authenticated with check (private.is_admin());
create policy "licenses admin update" on public.media_licenses
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "licenses admin delete" on public.media_licenses
  for delete to authenticated using (private.is_admin());

drop policy if exists "admins write media events" on public.media_review_events;
create policy "admins insert media events" on public.media_review_events
  for insert to authenticated with check (private.is_admin());
create policy "admins update media events" on public.media_review_events
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admins delete media events" on public.media_review_events
  for delete to authenticated using (private.is_admin());

-- The former public RLS helpers no longer have policy dependencies and can be
-- removed from the Data API surface.
revoke all on function public.is_admin()
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function public.owns_plan(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function public.owns_day(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function public.owns_session(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function public.owns_session_exercise(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;

drop function public.is_admin();
drop function public.owns_plan(uuid);
drop function public.owns_day(uuid);
drop function public.owns_session(uuid);
drop function public.owns_session_exercise(uuid);

-- SECURITY DEFINER functions left in public are entry points with a deliberate
-- owner-only, Auth Hook-only, or service-role-only privilege model.
alter function public.hook_restrict_signup(jsonb) set search_path = '';
revoke all on function public.hook_restrict_signup(jsonb)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.hook_restrict_signup(jsonb) to supabase_auth_admin;

alter function public.handle_new_user() set search_path = '';
revoke all on function public.handle_new_user()
  from public, anon, authenticated, service_role, supabase_auth_admin;

alter function public.enforce_plan_activation() set search_path = '';
revoke all on function public.enforce_plan_activation()
  from public, anon, authenticated, service_role, supabase_auth_admin;

alter function public.publish_exercise_media(uuid, uuid) set search_path = '';
revoke all on function public.publish_exercise_media(uuid, uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.publish_exercise_media(uuid, uuid) to service_role;

-- Trigger-only functions do not need direct execution by Data API roles.
revoke all on function public.set_updated_at()
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function public.enforce_exercise_media()
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function public.validate_media_approval()
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function public.protect_active_exercise_media()
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function public.enforce_server_media_approval()
  from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all on function public.prevent_primary_media_regression()
  from public, anon, authenticated, service_role, supabase_auth_admin;

-- Public RPCs retain only the roles used by the application.
revoke all on function public.complete_onboarding(jsonb)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.complete_onboarding(jsonb) to authenticated;
revoke all on function public.activate_plan(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.activate_plan(uuid) to authenticated;
revoke all on function public.finish_workout(uuid, text)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.finish_workout(uuid, text) to authenticated;
revoke all on function public.delete_own_account_data()
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.delete_own_account_data() to authenticated;
revoke all on function public.get_plan_readiness(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.get_plan_readiness(uuid) to authenticated;
revoke all on function public.start_workout(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.start_workout(uuid) to authenticated;

-- Internal helpers needed by invoker-trigger/RPC execution are explicit and
-- remain SECURITY INVOKER, so table privileges and RLS still apply.
revoke all on function public.exercise_has_approved_primary(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.exercise_has_approved_primary(uuid)
  to authenticated, service_role;
revoke all on function public.is_valid_primary_checklist(jsonb)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.is_valid_primary_checklist(jsonb)
  to authenticated, service_role;
revoke all on function public.get_exercise_publish_readiness(uuid)
  from public, anon, authenticated, service_role, supabase_auth_admin;

alter default privileges in schema public revoke execute on functions from public;

-- Cover only foreign-key leading columns that did not already have an index.
create index if not exists exercise_equipment_equipment_idx
  on public.exercise_equipment(equipment_id);
create index if not exists exercise_media_approved_by_idx
  on public.exercise_media(approved_by);
create index if not exists exercise_media_license_code_idx
  on public.exercise_media(license_code);
create index if not exists exercise_media_reviewed_by_idx
  on public.exercise_media(reviewed_by);
create index if not exists exercise_media_verified_by_idx
  on public.exercise_media(verified_by);
create index if not exists exercise_substitutions_alternative_exercise_idx
  on public.exercise_substitutions(alternative_exercise_id);
create index if not exists media_review_events_admin_user_idx
  on public.media_review_events(admin_user_id);
create index if not exists user_equipment_equipment_idx
  on public.user_equipment(equipment_id);
create index if not exists user_exercise_preferences_exercise_idx
  on public.user_exercise_preferences(exercise_id);
create index if not exists workout_session_exercises_actual_exercise_idx
  on public.workout_session_exercises(actual_exercise_id);
create index if not exists workout_session_exercises_planned_exercise_idx
  on public.workout_session_exercises(planned_exercise_id);
create index if not exists workout_sessions_workout_day_idx
  on public.workout_sessions(workout_day_id);
