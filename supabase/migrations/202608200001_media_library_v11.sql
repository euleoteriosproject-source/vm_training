create table public.media_licenses (
  code text primary key,
  name text not null,
  canonical_url text,
  attribution_required boolean not null default false,
  share_alike boolean not null default false,
  commercial_use_allowed boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.media_licenses(code,name,canonical_url,attribution_required,share_alike) values
('PD','Public Domain','https://commons.wikimedia.org/wiki/Commons:Copyright_tags/Public_domain',false,false),
('CC0-1.0','CC0 1.0','https://creativecommons.org/publicdomain/zero/1.0/',false,false),
('CC-BY-3.0','Creative Commons Attribution 3.0','https://creativecommons.org/licenses/by/3.0/',true,false),
('CC-BY-4.0','Creative Commons Attribution 4.0','https://creativecommons.org/licenses/by/4.0/',true,false),
('CC-BY-SA-3.0','Creative Commons Attribution-ShareAlike 3.0','https://creativecommons.org/licenses/by-sa/3.0/',true,true),
('CC-BY-SA-4.0','Creative Commons Attribution-ShareAlike 4.0','https://creativecommons.org/licenses/by-sa/4.0/',true,true),
('VITAL-FREE-PACK','Vital Animations Free Pack',null,true,false),
('CUSTOM','Custom / self-produced',null,false,false)
on conflict(code) do nothing;

create table public.exercise_aliases (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  alias text not null,
  locale text not null default 'en',
  created_at timestamptz not null default now(),
  unique(exercise_id,alias)
);

alter table public.exercise_media drop constraint if exists exercise_media_status_check;
alter table public.exercise_media drop constraint if exists exercise_media_source_type_check;
alter table public.exercise_media drop constraint if exists exercise_media_angle_check;
alter table public.exercise_media alter column storage_path drop not null;
alter table public.exercise_media add column if not exists source_name text;
alter table public.exercise_media add column if not exists license_code text references public.media_licenses(code);
alter table public.exercise_media add column if not exists license_url text;
alter table public.exercise_media add column if not exists author text;
alter table public.exercise_media add column if not exists attribution_text text;
alter table public.exercise_media add column if not exists attribution_required boolean not null default false;
alter table public.exercise_media add column if not exists original_file_url text;
alter table public.exercise_media add column if not exists verified_at timestamptz;
alter table public.exercise_media add column if not exists verified_by uuid references public.profiles(user_id) on delete set null;
alter table public.exercise_media add column if not exists downloaded_at timestamptz;
alter table public.exercise_media add column if not exists content_hash text;
alter table public.exercise_media add column if not exists width integer;
alter table public.exercise_media add column if not exists height integer;
alter table public.exercise_media add column if not exists file_size_bytes bigint;
alter table public.exercise_media add column if not exists is_primary boolean not null default false;
alter table public.exercise_media add column if not exists quality_score integer;
alter table public.exercise_media add column if not exists review_notes text;
alter table public.exercise_media add column if not exists execution_quality text not null default 'acceptable';
alter table public.exercise_media add column if not exists trim_start numeric not null default 0;
alter table public.exercise_media add column if not exists trim_end numeric;
alter table public.exercise_media add column if not exists candidate_metadata jsonb not null default '{}'::jsonb;
alter table public.exercise_media add column if not exists match_score integer;
alter table public.exercise_media add column if not exists match_details jsonb not null default '{}'::jsonb;

update public.exercise_media set source_type=case source_type
  when 'self_hosted' then 'self_produced'
  when 'licensed' then 'licensed_pack'
  else source_type end;
update public.exercise_media set attribution_text=coalesce(attribution_text,attribution);
update public.exercise_media set status='reviewing' where status='approved' and (
  license_code is null or content_hash is null or poster_path is null or verified_at is null or verified_by is null
);

alter table public.exercise_media add constraint exercise_media_status_check check(status in ('pending','reviewing','approved','rejected'));
alter table public.exercise_media add constraint exercise_media_source_type_check check(source_type in ('public_domain','creative_commons','licensed_pack','self_produced','external_embed'));
alter table public.exercise_media add constraint exercise_media_angle_check check(angle in ('main','front','side','rear','detail'));
alter table public.exercise_media add constraint exercise_media_execution_quality_check check(execution_quality in ('approved','acceptable','rejected'));
alter table public.exercise_media add constraint exercise_media_quality_score_check check(quality_score is null or quality_score between 0 and 100);
alter table public.exercise_media add constraint exercise_media_match_score_check check(match_score is null or match_score between 0 and 100);
alter table public.exercise_media add constraint exercise_media_dimensions_check check((width is null or width > 0) and (height is null or height > 0));
alter table public.exercise_media add constraint exercise_media_file_size_check check(file_size_bytes is null or file_size_bytes > 0);
alter table public.exercise_media add constraint exercise_media_trim_check check(trim_start >= 0 and (trim_end is null or trim_end > trim_start));

create unique index exercise_media_content_hash_unique on public.exercise_media(content_hash) where content_hash is not null;
alter table public.exercise_media add constraint exercise_media_candidate_source_unique unique(exercise_id,source_url);
create unique index exercise_media_one_primary on public.exercise_media(exercise_id) where is_primary;
create index exercise_media_review_queue_idx on public.exercise_media(status,match_score desc,created_at);
create index exercise_aliases_exercise_idx on public.exercise_aliases(exercise_id);

create or replace function public.validate_media_approval() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.status='approved' then
    if new.storage_path is null or new.poster_path is null or new.content_hash is null
       or new.source_url is null or new.source_name is null or new.source_type is null or new.license_code is null
       or new.author is null or new.attribution_text is null
       or new.verified_at is null or new.verified_by is null
       or new.execution_quality <> 'approved' then
      raise exception 'Mídia aprovada requer arquivo processado, poster, hash, origem, licença, verificação e qualidade de execução aprovada';
    end if;
    if new.attribution_required and (new.author is null or new.attribution_text is null or new.license_url is null) then
      raise exception 'Licença com atribuição requer autor, texto e URL da licença';
    end if;
  end if;
  if new.is_primary and (new.status <> 'approved' or new.execution_quality <> 'approved') then
    raise exception 'Somente mídia aprovada tecnicamente pode ser principal';
  end if;
  if tg_op='UPDATE' and old.status <> 'approved' and new.status='approved' and auth.role()='authenticated' then
    raise exception 'Aprovação deve ocorrer exclusivamente no servidor';
  end if;
  return new;
end;
$$;
create trigger validate_media_approval_before_write before insert or update on public.exercise_media
for each row execute function public.validate_media_approval();

alter table public.media_licenses enable row level security;
alter table public.exercise_aliases enable row level security;
create policy "licenses readable" on public.media_licenses for select to authenticated using(active or public.is_admin());
create policy "licenses admin write" on public.media_licenses for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "aliases readable" on public.exercise_aliases for select to authenticated using(true);
create policy "aliases admin write" on public.exercise_aliases for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists "global media read" on public.exercise_media;
create policy "approved media read" on public.exercise_media for select to authenticated
using(status='approved' or public.is_admin());

drop policy if exists "authenticated reads exercise media" on storage.objects;
create policy "approved exercise media files read" on storage.objects for select to authenticated
using(
  bucket_id='exercise-media' and (
    public.is_admin() or exists(
      select 1 from public.exercise_media media
      where media.status='approved'
        and (media.storage_path=storage.objects.name or media.poster_path=storage.objects.name)
    )
  )
);

create trigger set_media_licenses_updated_at before update on public.media_licenses
for each row execute function public.set_updated_at();

insert into public.exercise_aliases(exercise_id,alias,locale)
select id, alias, 'en' from public.exercises cross join lateral unnest(case slug
  when 'leg-press' then array['Seated leg press','Leg press machine']
  when 'hack-squat' then array['Hack squat machine']
  when 'smith-squat' then array['Smith machine squat']
  when 'goblet-squat' then array['Dumbbell goblet squat']
  when 'leg-extension' then array['Leg extension machine','Seated leg extension']
  when 'lying-leg-curl' then array['Lying leg curl','Prone leg curl']
  when 'seated-leg-curl' then array['Seated leg curl']
  when 'hip-thrust' then array['Barbell hip thrust']
  when 'machine-glute' then array['Glute kickback machine']
  when 'calf-raise' then array['Standing calf raise']
  when 'lat-pulldown' then array['Lat pulldown','Front pulldown']
  when 'neutral-pulldown' then array['Neutral grip lat pulldown']
  when 'supinated-pulldown' then array['Reverse grip lat pulldown']
  when 'seated-row' then array['Seated cable row','Cable row','Low row']
  when 'machine-row' then array['Row machine','Seated row machine']
  when 'one-arm-row' then array['One arm dumbbell row']
  when 'reverse-fly' then array['Reverse fly','Rear delt fly']
  when 'face-pull' then array['Cable face pull']
  when 'machine-chest-press' then array['Seated chest press','Chest press machine','Chest press']
  when 'incline-machine-press' then array['Incline chest press machine']
  when 'machine-fly' then array['Pec deck','Machine chest fly']
  when 'machine-shoulder-press' then array['Seated shoulder press machine']
  when 'lateral-raise' then array['Dumbbell lateral raise']
  when 'dead-bug' then array['Dead bug exercise']
  when 'plank' then array['Forearm plank']
  when 'pallof-press' then array['Cable Pallof press']
  when 'farmer-walk' then array['Farmers walk','Farmer carry']
  when 'wall-slide' then array['Wall slide exercise']
  when 'chin-tuck' then array['Cervical retraction','Chin tuck exercise']
  when 'thoracic-extension' then array['Thoracic extension exercise']
  when 'treadmill' then array['Treadmill walking']
  when 'incline-treadmill' then array['Incline treadmill walking']
  when 'bike' then array['Stationary bicycle','Exercise bike']
  when 'elliptical' then array['Elliptical trainer']
  when 'walking' then array['Brisk walking']
  else array[name_pt] end) alias
on conflict(exercise_id,alias) do nothing;

-- Fontes revalidadas em 2026-08-19. Candidatos continuam pendentes até a
-- revisão biomecânica humana e o processamento server-side.
insert into public.exercise_media(
  exercise_id,media_type,storage_path,angle,status,source_name,source_type,source_url,
  license_code,license_url,author,attribution_text,attribution_required,original_file_url,
  file_size_bytes,width,height,match_score,match_details,candidate_metadata
)
select exercise.id,'video',null,'main','pending','Wikimedia Commons','public_domain',candidate.source_url,
  'PD','https://commons.wikimedia.org/wiki/Commons:Copyright_tags/Public_domain',
  'Centers for Disease Control and Prevention',candidate.attribution,false,candidate.original_file_url,
  candidate.file_size,candidate.width,candidate.height,candidate.match_score,candidate.match_details,candidate.metadata
from (
  values
    ('leg-press',
     'https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Seated_Leg_Press.webm',
     'https://upload.wikimedia.org/wikipedia/commons/8/83/Muscle_Strengthening_at_the_Gym_-_Seated_Leg_Press.webm',
     6632747::bigint,320,240,70,
     '{"exactName":true,"exactAlias":false,"equipment":true,"movementPattern":false,"muscle":false}'::jsonb,
     '{"title":"Muscle Strengthening at the Gym - Seated Leg Press.webm","licenseVerifiedAt":"2026-08-19","publisher":"Centers for Disease Control and Prevention"}'::jsonb,
     '“Muscle Strengthening at the Gym - Seated Leg Press.webm”. Fonte: Wikimedia Commons. Licença: Public Domain.'),
    ('machine-chest-press',
     'https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Chest_Press.webm',
     'https://upload.wikimedia.org/wikipedia/commons/7/70/Muscle_Strengthening_at_the_Gym_-_Chest_Press.webm',
     3562923::bigint,320,240,90,
     '{"exactName":false,"exactAlias":true,"equipment":true,"movementPattern":true,"muscle":true}'::jsonb,
     '{"title":"Muscle Strengthening at the Gym - Chest Press.webm","licenseVerifiedAt":"2026-08-19","publisher":"Centers for Disease Control and Prevention"}'::jsonb,
     '“Muscle Strengthening at the Gym - Chest Press.webm”. Fonte: Wikimedia Commons. Licença: Public Domain.'),
    ('machine-row',
     'https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Row_Machine.webm',
     'https://upload.wikimedia.org/wikipedia/commons/5/50/Muscle_Strengthening_at_the_Gym_-_Row_Machine.webm',
     3383080::bigint,320,240,90,
     '{"exactName":false,"exactAlias":true,"equipment":true,"movementPattern":true,"muscle":true}'::jsonb,
     '{"title":"Muscle Strengthening at the Gym - Row Machine.webm","licenseVerifiedAt":"2026-08-19","publisher":"Centers for Disease Control and Prevention"}'::jsonb,
     '“Muscle Strengthening at the Gym - Row Machine.webm”. Fonte: Wikimedia Commons. Licença: Public Domain.')
) as candidate(slug,source_url,original_file_url,file_size,width,height,match_score,match_details,metadata,attribution)
join public.exercises exercise on exercise.slug=candidate.slug
on conflict(exercise_id,source_url) do nothing;
