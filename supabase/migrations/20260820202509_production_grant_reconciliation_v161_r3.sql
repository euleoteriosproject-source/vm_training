-- VM Training v1.6.1-R3: canonical least-privilege ACL.
-- Semantic source: ops/production/proposed-grant-reconciliation-v161-r2.sql.
-- New public objects must declare their Data API grants explicitly.

begin;

-- Future objects owned by the application migration role start closed. Grants
-- must be explicit in the migration that creates or exposes each object.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;

-- Existing domain tables: remove the Hosted blanket ACL one object at a time.
revoke all privileges on table public.allowed_signup_emails from public, anon, authenticated, service_role;
revoke all privileges on table public.profiles from public, anon, authenticated, service_role;
revoke all privileges on table public.equipment from public, anon, authenticated, service_role;
revoke all privileges on table public.exercises from public, anon, authenticated, service_role;
revoke all privileges on table public.exercise_equipment from public, anon, authenticated, service_role;
revoke all privileges on table public.exercise_media from public, anon, authenticated, service_role;
revoke all privileges on table public.exercise_substitutions from public, anon, authenticated, service_role;
revoke all privileges on table public.training_preferences from public, anon, authenticated, service_role;
revoke all privileges on table public.user_goals from public, anon, authenticated, service_role;
revoke all privileges on table public.user_equipment from public, anon, authenticated, service_role;
revoke all privileges on table public.user_exercise_preferences from public, anon, authenticated, service_role;
revoke all privileges on table public.body_measurements from public, anon, authenticated, service_role;
revoke all privileges on table public.workout_plans from public, anon, authenticated, service_role;
revoke all privileges on table public.workout_days from public, anon, authenticated, service_role;
revoke all privileges on table public.workout_day_exercises from public, anon, authenticated, service_role;
revoke all privileges on table public.workout_sessions from public, anon, authenticated, service_role;
revoke all privileges on table public.workout_session_exercises from public, anon, authenticated, service_role;
revoke all privileges on table public.set_logs from public, anon, authenticated, service_role;
revoke all privileges on table public.cardio_logs from public, anon, authenticated, service_role;
revoke all privileges on table public.media_licenses from public, anon, authenticated, service_role;
revoke all privileges on table public.exercise_aliases from public, anon, authenticated, service_role;
revoke all privileges on table public.media_review_events from public, anon, authenticated, service_role;

-- Authenticated application access. Row ownership and admin authorization remain
-- enforced independently by RLS policies.
grant select, insert, update on table public.allowed_signup_emails to authenticated;
grant select, update on table public.profiles to authenticated;
grant select, insert, update on table public.equipment to authenticated;
grant select, insert, update on table public.exercises to authenticated;
grant select on table public.exercise_equipment to authenticated;
grant select on table public.exercise_media to authenticated;
grant select on table public.exercise_substitutions to authenticated;
grant select, insert, update, delete on table
  public.training_preferences,
  public.user_goals,
  public.user_equipment,
  public.user_exercise_preferences,
  public.body_measurements,
  public.workout_plans,
  public.workout_days,
  public.workout_day_exercises,
  public.workout_sessions,
  public.workout_session_exercises,
  public.set_logs,
  public.cardio_logs
to authenticated;

-- Server-only media, reporting, and release operations.
grant select on table
  public.profiles,
  public.equipment,
  public.exercises,
  public.exercise_equipment,
  public.exercise_aliases,
  public.media_licenses,
  public.workout_plans,
  public.workout_days,
  public.workout_day_exercises,
  public.allowed_signup_emails
to service_role;
grant select, insert, update, delete on table
  public.exercise_media,
  public.media_review_events
to service_role;
grant update(active) on table public.exercises to service_role;

-- The Auth Hook needs allowlist reads and nothing else in the domain schema.
grant select on table public.allowed_signup_emails to supabase_auth_admin;

-- Public and private schema access is explicit. anon keeps public USAGE for the
-- Data API but has no table or function privileges in the application schemas.
revoke create on schema public from public, anon, authenticated, service_role, supabase_auth_admin;
grant usage on schema public to anon, authenticated, service_role, supabase_auth_admin;
revoke all privileges on schema private from public, anon, service_role, supabase_auth_admin;
grant usage on schema private to authenticated;

-- Existing functions are reconciled individually; there is deliberately no
-- blanket function operation. Trigger-only functions retain no Data API grant.
revoke all privileges on function private.is_admin() from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all privileges on function private.owns_plan(uuid) from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all privileges on function private.owns_day(uuid) from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all privileges on function private.owns_session(uuid) from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all privileges on function private.owns_session_exercise(uuid) from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.owns_plan(uuid) to authenticated;
grant execute on function private.owns_day(uuid) to authenticated;
grant execute on function private.owns_session(uuid) to authenticated;
grant execute on function private.owns_session_exercise(uuid) to authenticated;

revoke all privileges on function public.hook_restrict_signup(jsonb) from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.hook_restrict_signup(jsonb) to supabase_auth_admin;

revoke all privileges on function public.publish_exercise_media(uuid, uuid) from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.publish_exercise_media(uuid, uuid) to service_role;

revoke all privileges on function public.complete_onboarding(jsonb) from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all privileges on function public.activate_plan(uuid) from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all privileges on function public.finish_workout(uuid, text) from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all privileges on function public.delete_own_account_data() from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all privileges on function public.get_plan_readiness(uuid) from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all privileges on function public.start_workout(uuid) from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.complete_onboarding(jsonb) to authenticated;
grant execute on function public.activate_plan(uuid) to authenticated;
grant execute on function public.finish_workout(uuid, text) to authenticated;
grant execute on function public.delete_own_account_data() to authenticated;
grant execute on function public.get_plan_readiness(uuid) to authenticated;
grant execute on function public.start_workout(uuid) to authenticated;

revoke all privileges on function public.exercise_has_approved_primary(uuid) from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all privileges on function public.is_valid_primary_checklist(jsonb) from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.exercise_has_approved_primary(uuid) to authenticated, service_role;
grant execute on function public.is_valid_primary_checklist(jsonb) to authenticated, service_role;

-- Trigger-only and owner-only routines present in Production.
revoke all privileges on function public.handle_new_user() from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all privileges on function public.enforce_plan_activation() from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all privileges on function public.set_updated_at() from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all privileges on function public.enforce_exercise_media() from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all privileges on function public.validate_media_approval() from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all privileges on function public.protect_active_exercise_media() from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all privileges on function public.enforce_server_media_approval() from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all privileges on function public.prevent_primary_media_regression() from public, anon, authenticated, service_role, supabase_auth_admin;
revoke all privileges on function public.get_exercise_publish_readiness(uuid) from public, anon, authenticated, service_role, supabase_auth_admin;

commit;
