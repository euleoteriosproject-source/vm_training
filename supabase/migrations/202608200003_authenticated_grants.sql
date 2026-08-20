-- RLS policies only filter rows after PostgreSQL role privileges have been
-- granted. Grant members only the operations used by the application; the
-- policies still restrict every private table to auth.uid().
grant usage on schema public to authenticated;

grant select, update on public.profiles to authenticated;

grant select on
  public.equipment,
  public.exercises,
  public.exercise_equipment,
  public.exercise_media,
  public.exercise_substitutions
to authenticated;

grant select, insert, update, delete on
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
