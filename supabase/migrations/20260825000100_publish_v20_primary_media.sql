-- Publish only the exact v2.0 artifacts after their immutable Storage uploads
-- and remote hash verification. Fresh/local databases have no operational
-- rows, so this data migration is intentionally a no-op there.

do $$
declare
  expected record;
  candidate_count integer;
  candidate public.exercise_media%rowtype;
begin
  for expected in
    select * from (values
      (
        'lat-pulldown',
        'https://commons.wikimedia.org/wiki/File:Common_Lat_Pulldown_Mistakes.webm',
        'b25b7fe9d9f0ce1aa829a2c076c8591290a8b85e5fcca59c41d224068a097bcb'
      ),
      (
        'farmer-walk',
        'https://www.dvidshub.net/video/640980/farmer-carry',
        '62bb655d0c6f1033fb5029f0ce3d28e73e93f60c1ffe58a2ea4e9feabe5f9d8a'
      ),
      (
        'plank',
        'https://www.dvidshub.net/video/640237/plank',
        '750a45d306d0fbfe7929090bd0407d33f741f0fd509db3ff6697c0919950277e'
      )
    ) as artifacts(exercise_slug, source_url, content_hash)
  loop
    select count(*)::integer
    into candidate_count
    from public.exercise_media media
    join public.exercises exercise on exercise.id = media.exercise_id
    where exercise.slug = expected.exercise_slug
      and media.source_url = expected.source_url;

    if candidate_count = 0 then
      continue;
    end if;
    if candidate_count <> 1 then
      raise exception 'Expected one v2.0 candidate for %, found %',
        expected.exercise_slug, candidate_count;
    end if;

    select media.*
    into strict candidate
    from public.exercise_media media
    join public.exercises exercise on exercise.id = media.exercise_id
    where exercise.slug = expected.exercise_slug
      and media.source_url = expected.source_url;

    if candidate.content_hash <> expected.content_hash
       or candidate.storage_path is null
       or candidate.poster_path is null then
      raise exception 'v2.0 artifact identity failed for %', expected.exercise_slug;
    end if;

    if candidate.status = 'approved' then
      if candidate.review_state <> 'PUBLISHED'
         or candidate.review_method <> 'automated'
         or candidate.review_agent <> 'vm-media-validator-v20'
         or candidate.validation_version <> '2.0'
         or candidate.validation_confidence <> 'HIGH'
         or candidate.media_role <> 'PRIMARY_DEMO'
         or not candidate.is_primary
         or not private.is_valid_automated_media_validation(candidate.automated_validation) then
        raise exception 'Published v2.0 artifact diverges for %', expected.exercise_slug;
      end if;
      continue;
    end if;

    if candidate.status <> 'processed'
       or candidate.review_state <> 'AUTOMATED_VALIDATED'
       or candidate.review_method <> 'automated'
       or candidate.review_agent <> 'vm-media-validator-v20'
       or candidate.validation_version <> '2.0'
       or candidate.validation_confidence <> 'HIGH'
       or candidate.reviewed_by is not null
       or candidate.approved_by is not null
       or candidate.media_role <> 'PRIMARY_DEMO'
       or not private.is_valid_automated_media_validation(candidate.automated_validation) then
      raise exception 'v2.0 publication gate failed for %', expected.exercise_slug;
    end if;

    -- db push has no request JWT. Establish the transaction-local service
    -- context expected by the legacy approval trigger; no human identity is set.
    perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
    perform private.publish_validated_exercise_media_automated(
      candidate.id,
      'vm-media-validator-v20',
      '2.0'
    );
  end loop;
end;
$$;
