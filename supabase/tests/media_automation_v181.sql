begin;
grant usage on schema extensions to anon, authenticated, service_role;
set local search_path = public, extensions;
select plan(10);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.publish_validated_exercise_media_automated(uuid,text,text)',
    'execute'
  ),
  'authenticated cannot execute the automated publisher'
);
select ok(
  has_function_privilege(
    'service_role',
    'private.publish_validated_exercise_media_automated(uuid,text,text)',
    'execute'
  ),
  'service_role can execute the private automated publisher'
);
select ok(
  not has_schema_privilege('anon', 'private', 'usage'),
  'anon cannot access the private schema'
);

insert into public.exercise_media(
  id, exercise_id, media_type, storage_path, poster_path, status, media_role,
  source_name, source_type, source_url, original_file_url, license_code,
  license_url, author, attribution_text, content_hash, verified_at,
  reviewed_at, processed_at, execution_quality, review_checklist,
  animation_verified, frame_count, animation_loop, frames_per_second,
  duration_seconds, review_state, review_method, review_agent,
  validation_version, validation_confidence, automated_validation
)
select
  '91000000-0000-0000-0000-000000000001', id, 'gif',
  'exercises/machine-shoulder-press/primary/auto.gif',
  'exercises/machine-shoulder-press/primary/auto.webp', 'processed',
  'PRIMARY_DEMO', 'Wikimedia Commons', 'public_domain',
  'https://example.test/automated-shoulder-press',
  'https://example.test/automated-shoulder-press.webm', 'PD',
  'https://commons.wikimedia.org/wiki/Commons:Copyright_tags/Public_domain',
  'CDC', 'CDC / Wikimedia Commons / Public Domain', 'auto-v181-hash', now(),
  now(), now(), 'approved',
  '{"correct_exercise":true,"compatible_equipment":true,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":true,"useful_framing":true,"no_blocking_elements":true,"license_confirmed":true}',
  true, 96, true, 12.5, 8, 'AUTOMATED_VALIDATED', 'automated',
  'vm-media-validator-v181', '1.8.1', 'HIGH',
  '{"exercise_match_exact":true,"equipment_match":true,"execution_quality_approved":true,"visibility_sufficient":true,"license_verified":true,"download_permitted":true,"transformation_permitted":true,"rehost_permitted":true,"source_provenance_verified":true,"visual_inspection_passed":true,"biomechanical_references_passed":true,"final_gif_inspection_passed":true,"storage_hash_verified":true}'
from public.exercises where slug = 'machine-shoulder-press';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"40000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
select throws_ok(
  $$select private.publish_validated_exercise_media_automated(
    '91000000-0000-0000-0000-000000000001',
    'vm-media-validator-v181',
    '1.8.1'
  )$$,
  '42501',
  null,
  'browser role cannot invoke automated publication'
);
reset role;

set local role service_role;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"service_role"}',
  true
);
select lives_ok(
  $$select private.publish_validated_exercise_media_automated(
    '91000000-0000-0000-0000-000000000001',
    'vm-media-validator-v181',
    '1.8.1'
  )$$,
  'service-only automated publication succeeds'
);
reset role;

select is(
  (select review_state from public.exercise_media
   where id = '91000000-0000-0000-0000-000000000001'),
  'PUBLISHED',
  'automated candidate becomes PUBLISHED'
);
select is(
  (select status from public.exercise_media
   where id = '91000000-0000-0000-0000-000000000001'),
  'approved',
  'automated candidate becomes approved'
);
select ok(
  (select reviewed_by is null and approved_by is null
   from public.exercise_media
   where id = '91000000-0000-0000-0000-000000000001'),
  'automated publication does not impersonate a human reviewer'
);
select is(
  (select count(*)::integer from public.media_review_events
   where media_id = '91000000-0000-0000-0000-000000000001'
     and action = 'automated_published'
     and admin_user_id is null),
  1,
  'automated publication writes a non-human audit event'
);
select is(
  (select active from public.exercises exercise
   join public.exercise_media media on media.exercise_id = exercise.id
   where media.id = '91000000-0000-0000-0000-000000000001'),
  false,
  'automated media publication does not change catalog activation'
);

select * from finish();
rollback;
