-- Publish only the exact v1.8.1 artifact after its Storage upload and remote
-- hash verification. Fresh/local databases have no such operational row, so
-- this data migration is intentionally a no-op there.

do $$
declare
  candidate_count integer;
  candidate public.exercise_media%rowtype;
begin
  select count(*)::integer
  into candidate_count
  from public.exercise_media media
  join public.exercises exercise on exercise.id = media.exercise_id
  where exercise.slug = 'machine-shoulder-press'
    and media.source_url = 'https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Overhead_Press.webm';

  if candidate_count = 0 then
    return;
  end if;
  if candidate_count <> 1 then
    raise exception 'Expected one v1.8.1 shoulder press candidate, found %', candidate_count;
  end if;

  select media.*
  into strict candidate
  from public.exercise_media media
  join public.exercises exercise on exercise.id = media.exercise_id
  where exercise.slug = 'machine-shoulder-press'
    and media.source_url = 'https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Overhead_Press.webm';

  if candidate.status <> 'processed'
     or candidate.review_state <> 'AUTOMATED_VALIDATED'
     or candidate.review_method <> 'automated'
     or candidate.review_agent <> 'vm-media-validator-v181'
     or candidate.validation_version <> '1.8.1'
     or candidate.validation_confidence <> 'HIGH'
     or candidate.reviewed_by is not null
     or candidate.approved_by is not null
     or candidate.content_hash <> 'a71ff463a30988ceac803a4d6ca81bee28f67966941c357f8c78d0d02ae402d8'
     or candidate.storage_path is null
     or candidate.poster_path is null
     or not private.is_valid_automated_media_validation(candidate.automated_validation) then
    raise exception 'v1.8.1 shoulder press candidate failed the promotion gate';
  end if;

  -- The legacy approval trigger checks the JWT role in addition to SQL ACLs.
  -- db push has no request JWT, so establish the same transaction-local
  -- service context used by the server-only path. No human identity is set.
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

  perform private.publish_validated_exercise_media_automated(
    candidate.id,
    'vm-media-validator-v181',
    '1.8.1'
  );
end;
$$;
