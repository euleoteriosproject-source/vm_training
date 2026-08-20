create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

create table public.allowed_signup_emails (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext unique not null,
  display_name text,
  default_role text not null default 'member' check (default_role in ('admin','member')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.hook_restrict_signup(event jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare requested_email extensions.citext;
begin
  requested_email := lower(trim(event->'user'->>'email'))::extensions.citext;
  if requested_email is null or not exists (
    select 1 from public.allowed_signup_emails where email = requested_email and active
  ) then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'Este cadastro não está autorizado para esta aplicação.'
    ));
  end if;
  return '{}'::jsonb;
end;
$$;
grant usage on schema public to supabase_auth_admin;
grant select on public.allowed_signup_emails to supabase_auth_admin;
grant execute on function public.hook_restrict_signup(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_restrict_signup(jsonb) from public, anon, authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email extensions.citext not null,
  display_name text,
  avatar_url text,
  birth_date date,
  height_cm numeric(5,2) check (height_cm between 100 and 250),
  onboarding_completed boolean not null default false,
  role text not null default 'member' check (role in ('admin','member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare invitation public.allowed_signup_emails%rowtype;
begin
  select * into invitation from public.allowed_signup_emails
  where email = lower(new.email)::extensions.citext and active;
  if invitation.id is null then raise exception 'unauthorized signup'; end if;
  insert into public.profiles(user_id,email,display_name,role)
  values(new.id, lower(new.email)::extensions.citext, invitation.display_name, invitation.default_role);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where user_id = auth.uid() and role = 'admin');
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create table public.equipment (
  id uuid primary key default gen_random_uuid(), slug text unique not null, name text not null,
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.exercises (
  id uuid primary key default gen_random_uuid(), slug text unique not null, name_pt text not null, name_en text,
  category text not null check (category in ('strength','cardio','mobility')),
  movement_pattern text not null check (movement_pattern in ('squat','hinge','horizontal_push','vertical_push','horizontal_pull','vertical_pull','carry','core_anti_extension','core_anti_rotation','core_flexion','hip_extension','knee_extension','knee_flexion','cardio','mobility','posture')),
  primary_muscles text[] not null default '{}', secondary_muscles text[] not null default '{}',
  difficulty text not null check (difficulty in ('beginner','intermediate','advanced')),
  execution_instructions text[] not null default '{}', breathing_instruction text,
  common_errors text[] not null default '{}', active boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.exercise_equipment (
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete restrict,
  required boolean not null default true, created_at timestamptz not null default now(),
  primary key(exercise_id,equipment_id)
);
create table public.exercise_media (
  id uuid primary key default gen_random_uuid(), exercise_id uuid not null references public.exercises(id) on delete cascade,
  media_type text not null check (media_type in ('video','gif','image')), storage_path text not null, poster_path text,
  angle text not null default 'main' check (angle in ('main','front','side','detail')), duration_seconds numeric,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  source_type text not null check (source_type in ('self_hosted','licensed','external_embed')), source_url text, attribution text,
  sort_order integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.exercise_substitutions (
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  alternative_exercise_id uuid not null references public.exercises(id) on delete cascade,
  score integer not null default 50 check(score between 0 and 100), reason text,
  same_movement_pattern boolean not null default false, same_primary_muscle boolean not null default false,
  created_at timestamptz not null default now(), primary key(exercise_id,alternative_exercise_id),
  check(exercise_id <> alternative_exercise_id)
);

create or replace function public.enforce_exercise_media() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.active and not exists (
    select 1 from public.exercise_media m where m.exercise_id = new.id and m.status = 'approved' and m.media_type in ('video','gif')
  ) then raise exception 'Exercício ativo requer vídeo ou GIF aprovado'; end if;
  return new;
end;
$$;
create constraint trigger exercise_requires_media after insert or update on public.exercises
deferrable initially deferred for each row execute function public.enforce_exercise_media();

create table public.training_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sessions_per_week smallint not null check(sessions_per_week between 2 and 5),
  session_minutes smallint not null check(session_minutes in (30,45,60,75,90)),
  cardio_preference smallint not null check(cardio_preference between 1 and 5),
  machine_preference text not null default 'none' check(machine_preference in ('machines','free_weights','none')),
  technical_preference text not null default 'simple' check(technical_preference in ('simple','technical')),
  variety_preference text not null default 'repeat' check(variety_preference in ('varied','repeat')),
  experience text not null check(experience in ('beginner','returning','intermediate','advanced')),
  training_location text not null check(training_location in ('full_gym','small_gym','condo','home','other')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_goals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  goal_code text not null, priority smallint not null check(priority > 0), active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,goal_code)
);
create table public.user_equipment (
  user_id uuid not null references auth.users(id) on delete cascade, equipment_id uuid not null references public.equipment(id) on delete cascade,
  available boolean not null default true, temporary_unavailable_until timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key(user_id,equipment_id)
);
create table public.user_exercise_preferences (
  user_id uuid not null references auth.users(id) on delete cascade, exercise_id uuid not null references public.exercises(id) on delete cascade,
  preference text not null check(preference in ('like','neutral','dislike','avoid')), notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key(user_id,exercise_id)
);
create table public.body_measurements (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  measured_at timestamptz not null default now(), weight_kg numeric(6,2) not null check(weight_kg between 30 and 400),
  waist_cm numeric(6,2), hips_cm numeric(6,2), chest_cm numeric(6,2), arm_cm numeric(6,2), thigh_cm numeric(6,2), body_fat_pct numeric(5,2),
  clothing_fit text check(clothing_fit in ('tighter','same','looser','much_looser')), notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.workout_plans (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, name text not null,
  status text not null default 'draft' check(status in ('draft','active','archived')), source text not null default 'generated' check(source in ('generated','custom')),
  sessions_per_week smallint not null check(sessions_per_week between 2 and 5), target_session_minutes smallint not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), activated_at timestamptz, archived_at timestamptz
);
create unique index one_active_plan_per_user on public.workout_plans(user_id) where status = 'active';
create table public.workout_days (
  id uuid primary key default gen_random_uuid(), workout_plan_id uuid not null references public.workout_plans(id) on delete cascade,
  name text not null, position smallint not null, estimated_minutes smallint not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workout_plan_id,position)
);
create table public.workout_day_exercises (
  id uuid primary key default gen_random_uuid(), workout_day_id uuid not null references public.workout_days(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict, position smallint not null,
  target_sets smallint not null check(target_sets between 1 and 20), rep_min smallint, rep_max smallint, target_duration_seconds integer,
  rest_seconds integer not null default 60, target_rpe numeric(3,1), target_rir numeric(3,1), notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workout_day_id,position)
);
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  workout_day_id uuid references public.workout_days(id) on delete set null, workout_plan_id uuid references public.workout_plans(id) on delete set null,
  started_at timestamptz not null default now(), completed_at timestamptz, status text not null default 'in_progress' check(status in ('in_progress','completed','cancelled')),
  duration_seconds integer, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.workout_session_exercises (
  id uuid primary key default gen_random_uuid(), workout_session_id uuid not null references public.workout_sessions(id) on delete cascade,
  planned_exercise_id uuid references public.exercises(id) on delete restrict, actual_exercise_id uuid not null references public.exercises(id) on delete restrict,
  position smallint not null, status text not null default 'pending' check(status in ('pending','completed','skipped')),
  substitution_reason text, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.set_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  session_exercise_id uuid not null references public.workout_session_exercises(id) on delete cascade, set_number smallint not null,
  weight_kg numeric(7,2), reps smallint, duration_seconds integer, rpe numeric(3,1), completed boolean not null default false,
  completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(session_exercise_id,set_number)
);
create table public.cardio_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  session_exercise_id uuid not null references public.workout_session_exercises(id) on delete cascade, modality text not null,
  duration_seconds integer not null check(duration_seconds >= 0), distance_km numeric(7,2), incline numeric(5,2), resistance numeric(5,2), rpe numeric(3,1),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create or replace function public.start_workout(p_workout_day_id uuid) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare new_session uuid; owning_plan uuid;
begin
  select d.workout_plan_id into owning_plan from public.workout_days d join public.workout_plans p on p.id=d.workout_plan_id
  where d.id=p_workout_day_id and p.user_id=auth.uid();
  if owning_plan is null then raise exception 'Treino não encontrado'; end if;
  insert into public.workout_sessions(user_id,workout_day_id,workout_plan_id) values(auth.uid(),p_workout_day_id,owning_plan) returning id into new_session;
  insert into public.workout_session_exercises(workout_session_id,planned_exercise_id,actual_exercise_id,position)
  select new_session,e.exercise_id,e.exercise_id,e.position from public.workout_day_exercises e where e.workout_day_id=p_workout_day_id order by e.position;
  insert into public.set_logs(user_id,session_exercise_id,set_number)
  select auth.uid(),se.id,n from public.workout_session_exercises se
  join public.workout_day_exercises de on de.workout_day_id=p_workout_day_id and de.exercise_id=se.planned_exercise_id and de.position=se.position
  cross join lateral generate_series(1,de.target_sets) n where se.workout_session_id=new_session;
  return new_session;
end;
$$;

create or replace function public.owns_plan(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.workout_plans where id=p_id and user_id=auth.uid()); $$;
create or replace function public.owns_day(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.workout_days d join public.workout_plans p on p.id=d.workout_plan_id where d.id=p_id and p.user_id=auth.uid()); $$;
create or replace function public.owns_session_exercise(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.workout_session_exercises e join public.workout_sessions s on s.id=e.workout_session_id where e.id=p_id and s.user_id=auth.uid()); $$;

alter table public.allowed_signup_emails enable row level security;
alter table public.profiles enable row level security;
alter table public.equipment enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_equipment enable row level security;
alter table public.exercise_media enable row level security;
alter table public.exercise_substitutions enable row level security;
alter table public.training_preferences enable row level security;
alter table public.user_goals enable row level security;
alter table public.user_equipment enable row level security;
alter table public.user_exercise_preferences enable row level security;
alter table public.body_measurements enable row level security;
alter table public.workout_plans enable row level security;
alter table public.workout_days enable row level security;
alter table public.workout_day_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_session_exercises enable row level security;
alter table public.set_logs enable row level security;
alter table public.cardio_logs enable row level security;

create policy "admin manages invitations" on public.allowed_signup_emails for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "own profile read" on public.profiles for select to authenticated using(user_id=auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "global equipment read" on public.equipment for select to authenticated using(true);
create policy "admin equipment write" on public.equipment for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "global exercises read" on public.exercises for select to authenticated using(true);
create policy "admin exercises write" on public.exercises for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "global exercise equipment read" on public.exercise_equipment for select to authenticated using(true);
create policy "admin exercise equipment write" on public.exercise_equipment for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "global media read" on public.exercise_media for select to authenticated using(true);
create policy "admin media write" on public.exercise_media for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "global substitutions read" on public.exercise_substitutions for select to authenticated using(true);
create policy "admin substitutions write" on public.exercise_substitutions for all to authenticated using(public.is_admin()) with check(public.is_admin());

create policy "own training preferences" on public.training_preferences for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "own goals" on public.user_goals for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "own equipment" on public.user_equipment for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "own exercise preferences" on public.user_exercise_preferences for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "own measurements" on public.body_measurements for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "own plans" on public.workout_plans for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "own days" on public.workout_days for all to authenticated using(public.owns_plan(workout_plan_id)) with check(public.owns_plan(workout_plan_id));
create policy "own planned exercises" on public.workout_day_exercises for all to authenticated using(public.owns_day(workout_day_id)) with check(public.owns_day(workout_day_id));
create policy "own sessions" on public.workout_sessions for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "own session exercises" on public.workout_session_exercises for all to authenticated using(public.owns_session_exercise(id)) with check(public.owns_session_exercise(id));
create policy "own sets" on public.set_logs for all to authenticated using(user_id=auth.uid() and public.owns_session_exercise(session_exercise_id)) with check(user_id=auth.uid() and public.owns_session_exercise(session_exercise_id));
create policy "own cardio" on public.cardio_logs for all to authenticated using(user_id=auth.uid() and public.owns_session_exercise(session_exercise_id)) with check(user_id=auth.uid() and public.owns_session_exercise(session_exercise_id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('exercise-media','exercise-media',false,52428800,array['video/mp4','video/webm','image/webp','image/jpeg','image/gif'])
on conflict(id) do nothing;
create policy "authenticated reads exercise media" on storage.objects for select to authenticated using(bucket_id='exercise-media');
create policy "admin uploads exercise media" on storage.objects for insert to authenticated with check(bucket_id='exercise-media' and public.is_admin());
create policy "admin updates exercise media" on storage.objects for update to authenticated using(bucket_id='exercise-media' and public.is_admin()) with check(bucket_id='exercise-media' and public.is_admin());
create policy "admin deletes exercise media" on storage.objects for delete to authenticated using(bucket_id='exercise-media' and public.is_admin());

do $$ declare t text; begin
  foreach t in array array['allowed_signup_emails','profiles','equipment','exercises','exercise_media','training_preferences','user_goals','user_equipment','user_exercise_preferences','body_measurements','workout_plans','workout_days','workout_day_exercises','workout_sessions','workout_session_exercises','set_logs','cardio_logs'] loop
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',t,t);
  end loop;
end $$;

create index body_measurements_user_measured_idx on public.body_measurements(user_id,measured_at desc);
create index user_goals_user_idx on public.user_goals(user_id);
create index user_equipment_user_idx on public.user_equipment(user_id);
create index workout_plans_user_created_idx on public.workout_plans(user_id,created_at desc);
create index workout_days_plan_idx on public.workout_days(workout_plan_id,position);
create index workout_day_exercises_day_idx on public.workout_day_exercises(workout_day_id,position);
create index workout_day_exercises_exercise_idx on public.workout_day_exercises(exercise_id);
create index workout_sessions_user_started_idx on public.workout_sessions(user_id,started_at desc);
create index workout_sessions_plan_idx on public.workout_sessions(workout_plan_id);
create index workout_session_exercises_session_idx on public.workout_session_exercises(workout_session_id,position);
create index set_logs_user_created_idx on public.set_logs(user_id,created_at desc);
create index set_logs_session_exercise_idx on public.set_logs(session_exercise_id,set_number);
create index cardio_logs_user_created_idx on public.cardio_logs(user_id,created_at desc);
create index exercise_media_exercise_status_idx on public.exercise_media(exercise_id,status);
