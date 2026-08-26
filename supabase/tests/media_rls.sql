begin;
grant usage on schema extensions to anon, authenticated, service_role;
set local search_path = public, extensions;
select plan(12);

insert into public.allowed_signup_emails(email,display_name,default_role) values
('media-admin@example.test','Media Admin','admin'),
('media-member@example.test','Media Member','member')
on conflict do nothing;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at) values
('30000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','media-admin@example.test','x',now(),now(),now()),
('40000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','media-member@example.test','x',now(),now(),now());

insert into public.exercises(
  slug,name_pt,category,movement_pattern,primary_muscles,difficulty,
  execution_instructions,active
) values (
  'media-rls-inactive-fixture','Fixture inativa de mídia','strength',
  'core_anti_extension',array['core'],'beginner',array['Teste local'],false
);

insert into public.exercise_media(
  id,exercise_id,media_type,storage_path,poster_path,status,media_role,source_name,
  source_type,source_url,license_code,license_url,author,attribution_text,
  content_hash,verified_at,verified_by,reviewed_at,reviewed_by,processed_at,
  execution_quality,review_checklist,animation_verified,frame_count,
  animation_loop,frames_per_second,fallback_reason,duration_seconds
)
select
  '50000000-0000-0000-0000-000000000005',id,'video',
  'exercises/test/primary/test.mp4','exercises/test/primary/test.webp','processed',
  'PRIMARY_DEMO','Test','public_domain',
  'https://commons.wikimedia.org/wiki/File:Test.webm','PD',
  'https://commons.wikimedia.org/wiki/Commons:Copyright_tags/Public_domain',
  'CDC','CDC / Wikimedia Commons / Public Domain','test-hash',now(),
  '30000000-0000-0000-0000-000000000003',now(),
  '30000000-0000-0000-0000-000000000003',now(),'approved',
  '{"correct_exercise":true,"compatible_equipment":true,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":true,"useful_framing":true,"no_blocking_elements":true,"license_confirmed":true}'::jsonb,
  true,180,true,30,'GIF_SIZE_TOO_LARGE',6
from public.exercises limit 1;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"40000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
select is(
  (select count(*)::integer from public.exercise_media where id='50000000-0000-0000-0000-000000000005'),
  0,
  'member cannot read media before publication'
);
select throws_ok(
  $$update public.exercise_media set status='approved' where id='50000000-0000-0000-0000-000000000005'$$,
  '42501',
  'permission denied for table exercise_media',
  'member cannot approve media'
);
reset role;
set local role service_role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000000","role":"service_role"}',true);

insert into public.exercise_media(
  id,exercise_id,media_type,storage_path,poster_path,status,media_role,source_name,
  source_type,source_url,license_code,license_url,author,attribution_text,
  content_hash,verified_at,verified_by,reviewed_at,reviewed_by,processed_at,
  execution_quality,review_checklist,animation_verified,frame_count,
  animation_loop,frames_per_second,duration_seconds
)
select
  '60000000-0000-0000-0000-000000000006',id,'image','static.webp','static-poster.webp','processed',
  'PRIMARY_DEMO','Test','public_domain','https://example.test/static','PD',
  'https://commons.wikimedia.org/wiki/Commons:Copyright_tags/Public_domain','CDC','Test',
  'static-hash',now(),'30000000-0000-0000-0000-000000000003',now(),
  '30000000-0000-0000-0000-000000000003',now(),'approved',
  '{"correct_exercise":true,"compatible_equipment":true,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":true,"useful_framing":true,"no_blocking_elements":true,"license_confirmed":true}',
  false,1,false,1,6
from public.exercises order by slug offset 1 limit 1;

select throws_ok(
  $$select public.publish_exercise_media('60000000-0000-0000-0000-000000000006','30000000-0000-0000-0000-000000000003')$$,
  'P0001',
  'PRIMARY_DEMO requer GIF animado verificado ou fallback MP4 documentado',
  'PRIMARY static image is rejected'
);

insert into public.exercise_media(
  id,exercise_id,media_type,storage_path,poster_path,status,media_role,source_name,
  source_type,source_url,license_code,license_url,author,attribution_text,
  content_hash,verified_at,verified_by,reviewed_at,reviewed_by,processed_at,
  execution_quality,review_checklist,animation_verified,frame_count,
  animation_loop,frames_per_second,duration_seconds
)
select
  '70000000-0000-0000-0000-000000000007',id,'gif','single.gif','single.webp','processed',
  'PRIMARY_DEMO','Test','public_domain','https://example.test/single','PD',
  'https://commons.wikimedia.org/wiki/Commons:Copyright_tags/Public_domain','CDC','Test',
  'single-hash',now(),'30000000-0000-0000-0000-000000000003',now(),
  '30000000-0000-0000-0000-000000000003',now(),'approved',
  '{"correct_exercise":true,"compatible_equipment":true,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":true,"useful_framing":true,"no_blocking_elements":true,"license_confirmed":true}',
  true,1,true,15,6
from public.exercises order by slug offset 2 limit 1;

select throws_ok(
  $$select public.publish_exercise_media('70000000-0000-0000-0000-000000000007','30000000-0000-0000-0000-000000000003')$$,
  'P0001',
  'PRIMARY_DEMO requer GIF animado verificado ou fallback MP4 documentado',
  'single-frame GIF is rejected'
);

insert into public.exercise_media(
  id,exercise_id,media_type,storage_path,poster_path,status,media_role,source_name,
  source_type,source_url,license_code,license_url,author,attribution_text,
  content_hash,verified_at,verified_by,reviewed_at,reviewed_by,processed_at,
  execution_quality,review_checklist,animation_verified,frame_count,
  animation_loop,frames_per_second,duration_seconds
)
select
  '80000000-0000-0000-0000-000000000008',id,'gif','animated.gif','animated.webp','processed',
  'PRIMARY_DEMO','Test','public_domain','https://example.test/animated','PD',
  'https://commons.wikimedia.org/wiki/Commons:Copyright_tags/Public_domain','CDC','Test',
  repeat('a',64),now(),'30000000-0000-0000-0000-000000000003',now(),
  '30000000-0000-0000-0000-000000000003',now(),'approved',
  '{"correct_exercise":true,"compatible_equipment":true,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":true,"useful_framing":true,"no_blocking_elements":true,"license_confirmed":true}',
  true,90,true,15,6
from public.exercises where slug='media-rls-inactive-fixture';

insert into storage.objects(bucket_id,name,metadata) values
  ('exercise-media','animated.gif','{"size":1024}'::jsonb),
  ('exercise-media','animated.webp','{"size":512}'::jsonb);

select lives_ok(
  $$select public.publish_exercise_media('80000000-0000-0000-0000-000000000008','30000000-0000-0000-0000-000000000003')$$,
  'animated GIF is accepted'
);
select ok(
  (select public.exercise_has_approved_primary(exercise_id) from public.exercise_media where id='80000000-0000-0000-0000-000000000008'),
  'approved GIF satisfies animated primary readiness'
);
select is(
  (select exercise.active from public.exercises exercise join public.exercise_media media on media.exercise_id=exercise.id where media.id='80000000-0000-0000-0000-000000000008'),
  false,
  'media publication does not change independent catalog activation'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"30000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select throws_ok(
  $$update public.exercise_media set status='approved' where id='50000000-0000-0000-0000-000000000005'$$,
  '42501',
  'permission denied for table exercise_media',
  'admin browser cannot approve directly'
);
reset role;

set local role service_role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000000","role":"service_role"}',true);
select lives_ok(
  $$select public.publish_exercise_media('50000000-0000-0000-0000-000000000005','30000000-0000-0000-0000-000000000003')$$,
  'server-side privileged publication succeeds'
);
reset role;

select is(
  (select status from public.exercise_media where id='50000000-0000-0000-0000-000000000005'),
  'approved',
  'published media is approved'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"40000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
select is(
  (select count(*)::integer from public.exercise_media where id in (
    '50000000-0000-0000-0000-000000000005',
    '80000000-0000-0000-0000-000000000008'
  )),
  2,
  'member can read the two approved test media rows'
);
reset role;

select throws_ok(
  $$insert into public.exercise_media(
      exercise_id,media_type,storage_path,poster_path,status,media_role,is_primary,
      source_name,source_type,source_url,license_code,license_url,author,
      attribution_text,content_hash,verified_at,verified_by,reviewed_at,reviewed_by,
      approved_at,approved_by,processed_at,execution_quality,review_checklist,
      animation_verified,frame_count,animation_loop,frames_per_second,
      fallback_reason,duration_seconds,review_state,review_method
    ) select exercise_id,'video','other.mp4','other.webp','approved','PRIMARY_DEMO',true,
      'Test','public_domain','https://commons.wikimedia.org/wiki/File:Other.webm',
      'PD','https://commons.wikimedia.org/wiki/Commons:Copyright_tags/Public_domain',
      'CDC','CDC / Wikimedia Commons / Public Domain','other-hash',now(),verified_by,
      now(),reviewed_by,now(),reviewed_by,now(),'approved',review_checklist,
      true,180,true,30,'GIF_SIZE_TOO_LARGE',6,'PUBLISHED','human'
    from public.exercise_media where id='50000000-0000-0000-0000-000000000005'$$,
  '23505',
  null,
  'only one approved PRIMARY_DEMO can be primary'
);

select * from finish();
rollback;
