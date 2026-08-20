begin;
select plan(7);

insert into public.allowed_signup_emails(email,display_name,default_role) values
('media-admin@example.test','Media Admin','admin'),
('media-member@example.test','Media Member','member')
on conflict do nothing;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at) values
('30000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','media-admin@example.test','x',now(),now(),now()),
('40000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','media-member@example.test','x',now(),now(),now());

insert into public.exercise_media(
  id,exercise_id,media_type,storage_path,poster_path,status,media_role,source_name,
  source_type,source_url,license_code,license_url,author,attribution_text,
  content_hash,verified_at,verified_by,reviewed_at,reviewed_by,processed_at,
  execution_quality,review_checklist
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
  '{"correct_exercise":true,"compatible_equipment":true,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":true,"useful_framing":true,"no_blocking_elements":true,"license_confirmed":true}'::jsonb
from public.exercises limit 1;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"40000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
select is(
  (select count(*)::integer from public.exercise_media),
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
  (select count(*)::integer from public.exercise_media),
  1,
  'member can read approved global media'
);
reset role;

select throws_ok(
  $$insert into public.exercise_media(
      exercise_id,media_type,storage_path,poster_path,status,media_role,is_primary,
      source_name,source_type,source_url,license_code,license_url,author,
      attribution_text,content_hash,verified_at,verified_by,reviewed_at,reviewed_by,
      approved_at,approved_by,processed_at,execution_quality,review_checklist
    ) select exercise_id,'video','other.mp4','other.webp','approved','PRIMARY_DEMO',true,
      'Test','public_domain','https://commons.wikimedia.org/wiki/File:Other.webm',
      'PD','https://commons.wikimedia.org/wiki/Commons:Copyright_tags/Public_domain',
      'CDC','CDC / Wikimedia Commons / Public Domain','other-hash',now(),verified_by,
      now(),reviewed_by,now(),reviewed_by,now(),'approved',review_checklist
    from public.exercise_media where id='50000000-0000-0000-0000-000000000005'$$,
  '23505',
  null,
  'only one approved PRIMARY_DEMO can be primary'
);

select * from finish();
rollback;
