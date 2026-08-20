grant usage on schema public to service_role;

grant select on
  public.profiles,
  public.equipment,
  public.exercises,
  public.exercise_equipment,
  public.exercise_aliases,
  public.media_licenses,
  public.workout_plans,
  public.workout_days,
  public.workout_day_exercises
to service_role;

grant select, insert, update, delete on
  public.exercise_media,
  public.media_review_events
to service_role;

grant update(active) on public.exercises to service_role;
