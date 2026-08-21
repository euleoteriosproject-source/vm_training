-- VM Training v1.6.1-R5 semantic candidate reconciliation proposal.
-- REVIEW ARTIFACT ONLY. DO NOT EXECUTE WITHOUT A SEPARATE APPROVED APPLY STEP.
-- Adds one validated bike source candidate, synchronizes v1.5 decisions for
-- 24 target identities, preserves Production-only candidates, and deletes none.

begin;

create temporary table r5_reconciliation_context on commit drop as
select
  (select count(*)::integer from public.exercise_media) as before_count,
  exists(
    select 1 from public.exercise_media media
    join public.exercises exercise on exercise.id = media.exercise_id
    where exercise.slug = 'bike'
      and media.source_url = 'https://commons.wikimedia.org/wiki/File:Man_on_an_Exercise_Bike_GIF_Animation_Loop.gif'
  ) as bike_was_present,
  (select count(*)::integer from storage.objects where bucket_id = 'exercise-media') as before_storage_count;

create temporary table r5_validation_payload on commit drop as
select * from jsonb_to_recordset($r5_validation$[{"candidate_id":"80eb98d2c2545580","exercise_slug":"leg-press","source_url":"https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Seated_Leg_Press.webm","decision":"APPROVE","target_status":"reviewing","execution_quality":"approved","recommended_role":"PRIMARY_DEMO","validation_score":96,"exercise_match":"EXACT","rejection_reason":null,"trim_start":0,"trim_end":null,"reasoning_summary":"Exact CDC public-domain demonstration; use a short, silent processed excerpt after frame-accurate trim selection.","review_checklist":{"correct_exercise":true,"compatible_equipment":true,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":true,"useful_framing":true,"no_blocking_elements":true,"license_confirmed":true,"references_verified":true,"validation_version":"1.5","validation_score":96,"exercise_match":"EXACT"}},{"candidate_id":"0c0bd7baeb151077","exercise_slug":"leg-press","source_url":"https://commons.wikimedia.org/wiki/File:How_to_properly_leg_press.webm","decision":"KEEP_PENDING","target_status":"pending","execution_quality":"acceptable","recommended_role":"EDUCATIONAL","validation_score":88,"exercise_match":"EXACT","rejection_reason":null,"trim_start":0,"trim_end":null,"reasoning_summary":"Technically relevant long-form education, but Wikimedia marks the video for license review; it cannot be approved.","review_checklist":{"correct_exercise":true,"compatible_equipment":true,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":true,"useful_framing":true,"no_blocking_elements":true,"license_confirmed":false,"references_verified":true,"validation_version":"1.5","validation_score":88,"exercise_match":"EXACT"}},{"candidate_id":"c7f0edf1ad88047b","exercise_slug":"leg-press","source_url":"https://commons.wikimedia.org/wiki/File:Exercisingwithmoderntech.gif","decision":"REJECT","target_status":"rejected","execution_quality":"rejected","recommended_role":null,"validation_score":18,"exercise_match":"INCORRECT","rejection_reason":"wrong_exercise","trim_start":0,"trim_end":null,"reasoning_summary":"Wrong exercise and equipment.","review_checklist":{"correct_exercise":false,"compatible_equipment":false,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":false,"sufficient_clarity":false,"useful_framing":false,"no_blocking_elements":false,"license_confirmed":true,"references_verified":true,"validation_version":"1.5","validation_score":18,"exercise_match":"INCORRECT"}},{"candidate_id":"1671caca9d4a2b28","exercise_slug":"leg-press","source_url":"https://commons.wikimedia.org/wiki/File:Squat-CDC_strength_training_for_older_adults.gif","decision":"REJECT","target_status":"rejected","execution_quality":"acceptable","recommended_role":null,"validation_score":42,"exercise_match":"RELATED_BUT_DIFFERENT","rejection_reason":"wrong_exercise","trim_start":0,"trim_end":null,"reasoning_summary":"Similar squat pattern is not a leg press.","review_checklist":{"correct_exercise":false,"compatible_equipment":false,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":false,"useful_framing":false,"no_blocking_elements":false,"license_confirmed":true,"references_verified":true,"validation_version":"1.5","validation_score":42,"exercise_match":"RELATED_BUT_DIFFERENT"}},{"candidate_id":"e2b4801df9db6b26","exercise_slug":"hack-squat","source_url":"https://commons.wikimedia.org/wiki/File:Squat-CDC_strength_training_for_older_adults.gif","decision":"REJECT","target_status":"rejected","execution_quality":"acceptable","recommended_role":null,"validation_score":38,"exercise_match":"RELATED_BUT_DIFFERENT","rejection_reason":"wrong_exercise","trim_start":0,"trim_end":null,"reasoning_summary":"No angled sled, back support or guided hack-squat path.","review_checklist":{"correct_exercise":false,"compatible_equipment":false,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":false,"useful_framing":false,"no_blocking_elements":false,"license_confirmed":true,"references_verified":true,"validation_version":"1.5","validation_score":38,"exercise_match":"RELATED_BUT_DIFFERENT"}},{"candidate_id":"72f6dc978f353ead","exercise_slug":"hack-squat","source_url":"https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_Home_-_Half_squat.webm","decision":"REJECT","target_status":"rejected","execution_quality":"acceptable","recommended_role":null,"validation_score":40,"exercise_match":"RELATED_BUT_DIFFERENT","rejection_reason":"wrong_exercise","trim_start":0,"trim_end":null,"reasoning_summary":"Wrong equipment and materially different range/loading.","review_checklist":{"correct_exercise":false,"compatible_equipment":false,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":false,"useful_framing":false,"no_blocking_elements":false,"license_confirmed":true,"references_verified":true,"validation_version":"1.5","validation_score":40,"exercise_match":"RELATED_BUT_DIFFERENT"}},{"candidate_id":"7a7d1d1355b6e9e1","exercise_slug":"smith-squat","source_url":"https://commons.wikimedia.org/wiki/File:Squat-CDC_strength_training_for_older_adults.gif","decision":"REJECT","target_status":"rejected","execution_quality":"acceptable","recommended_role":null,"validation_score":38,"exercise_match":"RELATED_BUT_DIFFERENT","rejection_reason":"wrong_exercise","trim_start":0,"trim_end":null,"reasoning_summary":"A Smith squat requires a guided bar and machine.","review_checklist":{"correct_exercise":false,"compatible_equipment":false,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":false,"useful_framing":false,"no_blocking_elements":false,"license_confirmed":true,"references_verified":true,"validation_version":"1.5","validation_score":38,"exercise_match":"RELATED_BUT_DIFFERENT"}},{"candidate_id":"f2bf2b10305aeffa","exercise_slug":"smith-squat","source_url":"https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_Home_-_Half_squat.webm","decision":"REJECT","target_status":"rejected","execution_quality":"acceptable","recommended_role":null,"validation_score":40,"exercise_match":"RELATED_BUT_DIFFERENT","rejection_reason":"wrong_exercise","trim_start":0,"trim_end":null,"reasoning_summary":"No guided Smith bar or machine is present.","review_checklist":{"correct_exercise":false,"compatible_equipment":false,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":false,"useful_framing":false,"no_blocking_elements":false,"license_confirmed":true,"references_verified":true,"validation_version":"1.5","validation_score":40,"exercise_match":"RELATED_BUT_DIFFERENT"}},{"candidate_id":"e8126275ec36715b","exercise_slug":"goblet-squat","source_url":"https://commons.wikimedia.org/wiki/File:Kettlebell_Goblet_Squat.webm","decision":"APPROVE","target_status":"reviewing","execution_quality":"approved","recommended_role":"PRIMARY_DEMO","validation_score":98,"exercise_match":"EXACT","rejection_reason":null,"trim_start":5,"trim_end":12,"reasoning_summary":"Exact, clearly visible exercise with verified CC BY-SA 4.0 permission record.","review_checklist":{"correct_exercise":true,"compatible_equipment":true,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":true,"useful_framing":true,"no_blocking_elements":true,"license_confirmed":true,"references_verified":true,"validation_version":"1.5","validation_score":98,"exercise_match":"EXACT"}},{"candidate_id":"38dc3a1ed90bdf03","exercise_slug":"goblet-squat","source_url":"https://commons.wikimedia.org/wiki/File:Squat-CDC_strength_training_for_older_adults.gif","decision":"REJECT","target_status":"rejected","execution_quality":"acceptable","recommended_role":null,"validation_score":45,"exercise_match":"RELATED_BUT_DIFFERENT","rejection_reason":"wrong_exercise","trim_start":0,"trim_end":null,"reasoning_summary":"Missing the defining goblet load and position.","review_checklist":{"correct_exercise":false,"compatible_equipment":false,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":false,"useful_framing":false,"no_blocking_elements":false,"license_confirmed":true,"references_verified":true,"validation_version":"1.5","validation_score":45,"exercise_match":"RELATED_BUT_DIFFERENT"}},{"candidate_id":"69d50f521aea630c","exercise_slug":"goblet-squat","source_url":"https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_Home_-_Half_squat.webm","decision":"REJECT","target_status":"rejected","execution_quality":"acceptable","recommended_role":null,"validation_score":45,"exercise_match":"RELATED_BUT_DIFFERENT","rejection_reason":"wrong_exercise","trim_start":0,"trim_end":null,"reasoning_summary":"Missing the goblet load and full expected movement.","review_checklist":{"correct_exercise":false,"compatible_equipment":false,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":false,"useful_framing":false,"no_blocking_elements":false,"license_confirmed":true,"references_verified":true,"validation_version":"1.5","validation_score":45,"exercise_match":"RELATED_BUT_DIFFERENT"}},{"candidate_id":"e84f0b22b7b81375","exercise_slug":"leg-extension","source_url":"https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Leg_Extension.webm","decision":"APPROVE","target_status":"reviewing","execution_quality":"approved","recommended_role":"PRIMARY_DEMO","validation_score":97,"exercise_match":"EXACT","rejection_reason":null,"trim_start":0,"trim_end":null,"reasoning_summary":"Exact CDC public-domain machine demonstration; process a short excerpt before publishing.","review_checklist":{"correct_exercise":true,"compatible_equipment":true,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":true,"useful_framing":true,"no_blocking_elements":true,"license_confirmed":true,"references_verified":true,"validation_version":"1.5","validation_score":97,"exercise_match":"EXACT"}},{"candidate_id":"ce0a5122e15e0d69","exercise_slug":"leg-extension","source_url":"https://commons.wikimedia.org/wiki/File:Knee_extension-CDC_strength_training_for_older_adults.gif","decision":"REJECT","target_status":"rejected","execution_quality":"acceptable","recommended_role":null,"validation_score":52,"exercise_match":"RELATED_BUT_DIFFERENT","rejection_reason":"wrong_exercise","trim_start":0,"trim_end":null,"reasoning_summary":"Correct joint action but wrong resistance equipment.","review_checklist":{"correct_exercise":false,"compatible_equipment":false,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":false,"useful_framing":false,"no_blocking_elements":false,"license_confirmed":true,"references_verified":true,"validation_version":"1.5","validation_score":52,"exercise_match":"RELATED_BUT_DIFFERENT"}},{"candidate_id":"bc552436c04ac9b7","exercise_slug":"lying-leg-curl","source_url":"https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Leg_Curl.webm","decision":"REJECT","target_status":"rejected","execution_quality":"approved","recommended_role":null,"validation_score":48,"exercise_match":"INCORRECT","rejection_reason":"wrong_exercise","trim_start":0,"trim_end":null,"reasoning_summary":"Body position identifies a different catalog exercise: seated leg curl.","review_checklist":{"correct_exercise":false,"compatible_equipment":false,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":false,"useful_framing":false,"no_blocking_elements":false,"license_confirmed":true,"references_verified":true,"validation_version":"1.5","validation_score":48,"exercise_match":"INCORRECT"}},{"candidate_id":"dc9c85d86b7e601d","exercise_slug":"seated-leg-curl","source_url":"https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Leg_Curl.webm","decision":"APPROVE","target_status":"reviewing","execution_quality":"approved","recommended_role":"PRIMARY_DEMO","validation_score":96,"exercise_match":"EXACT","rejection_reason":null,"trim_start":0,"trim_end":null,"reasoning_summary":"Exact CDC public-domain demonstration; process a short excerpt before publishing.","review_checklist":{"correct_exercise":true,"compatible_equipment":true,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":true,"useful_framing":true,"no_blocking_elements":true,"license_confirmed":true,"references_verified":true,"validation_version":"1.5","validation_score":96,"exercise_match":"EXACT"}},{"candidate_id":"3174bc031cbcf2b8","exercise_slug":"lat-pulldown","source_url":"https://commons.wikimedia.org/wiki/File:Common_Lat_Pulldown_Mistakes.webm","decision":"KEEP_PENDING","target_status":"pending","execution_quality":"acceptable","recommended_role":"EDUCATIONAL","validation_score":88,"exercise_match":"EXACT","rejection_reason":null,"trim_start":0,"trim_end":null,"reasoning_summary":"Useful educational content, but Wikimedia flags the license for review, so approval is blocked.","review_checklist":{"correct_exercise":true,"compatible_equipment":true,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":true,"useful_framing":true,"no_blocking_elements":true,"license_confirmed":false,"references_verified":true,"validation_version":"1.5","validation_score":88,"exercise_match":"EXACT"}},{"candidate_id":"c67f0842725ad27c","exercise_slug":"neutral-pulldown","source_url":"https://commons.wikimedia.org/wiki/File:Common_Lat_Pulldown_Mistakes.webm","decision":"REJECT","target_status":"rejected","execution_quality":"acceptable","recommended_role":null,"validation_score":66,"exercise_match":"RELATED_BUT_DIFFERENT","rejection_reason":"wrong_exercise","trim_start":0,"trim_end":null,"reasoning_summary":"The defining grip does not match; the source also has unresolved license review.","review_checklist":{"correct_exercise":false,"compatible_equipment":true,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":false,"useful_framing":false,"no_blocking_elements":false,"license_confirmed":false,"references_verified":true,"validation_version":"1.5","validation_score":66,"exercise_match":"RELATED_BUT_DIFFERENT"}},{"candidate_id":"bec02db7c0e5540f","exercise_slug":"supinated-pulldown","source_url":"https://commons.wikimedia.org/wiki/File:Common_Lat_Pulldown_Mistakes.webm","decision":"REJECT","target_status":"rejected","execution_quality":"acceptable","recommended_role":null,"validation_score":66,"exercise_match":"RELATED_BUT_DIFFERENT","rejection_reason":"wrong_exercise","trim_start":0,"trim_end":null,"reasoning_summary":"The defining grip does not match; the source also has unresolved license review.","review_checklist":{"correct_exercise":false,"compatible_equipment":true,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":false,"useful_framing":false,"no_blocking_elements":false,"license_confirmed":false,"references_verified":true,"validation_version":"1.5","validation_score":66,"exercise_match":"RELATED_BUT_DIFFERENT"}},{"candidate_id":"d8a9d8634fe83558","exercise_slug":"seated-row","source_url":"https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Row_Machine.webm","decision":"REJECT","target_status":"rejected","execution_quality":"approved","recommended_role":null,"validation_score":74,"exercise_match":"RELATED_BUT_DIFFERENT","rejection_reason":"wrong_exercise","trim_start":0,"trim_end":null,"reasoning_summary":"Equipment identity differs from the catalog exercise.","review_checklist":{"correct_exercise":false,"compatible_equipment":false,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":false,"useful_framing":false,"no_blocking_elements":false,"license_confirmed":true,"references_verified":true,"validation_version":"1.5","validation_score":74,"exercise_match":"RELATED_BUT_DIFFERENT"}},{"candidate_id":"fa3314301801fe84","exercise_slug":"machine-row","source_url":"https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Row_Machine.webm","decision":"APPROVE","target_status":"reviewing","execution_quality":"approved","recommended_role":"PRIMARY_DEMO","validation_score":96,"exercise_match":"EXACT","rejection_reason":null,"trim_start":0,"trim_end":null,"reasoning_summary":"Exact CDC public-domain demonstration; process a short excerpt before publishing.","review_checklist":{"correct_exercise":true,"compatible_equipment":true,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":true,"useful_framing":true,"no_blocking_elements":true,"license_confirmed":true,"references_verified":true,"validation_version":"1.5","validation_score":96,"exercise_match":"EXACT"}},{"candidate_id":"d30d76720bbdb703","exercise_slug":"machine-chest-press","source_url":"https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Chest_Press.webm","decision":"APPROVE","target_status":"reviewing","execution_quality":"approved","recommended_role":"PRIMARY_DEMO","validation_score":97,"exercise_match":"EXACT","rejection_reason":null,"trim_start":0,"trim_end":null,"reasoning_summary":"Exact CDC public-domain demonstration; process a short excerpt before publishing.","review_checklist":{"correct_exercise":true,"compatible_equipment":true,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":true,"useful_framing":true,"no_blocking_elements":true,"license_confirmed":true,"references_verified":true,"validation_version":"1.5","validation_score":97,"exercise_match":"EXACT"}},{"candidate_id":"8c7b25d64e1f3dd6","exercise_slug":"machine-fly","source_url":"https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Chest_Press.webm","decision":"REJECT","target_status":"rejected","execution_quality":"approved","recommended_role":null,"validation_score":42,"exercise_match":"RELATED_BUT_DIFFERENT","rejection_reason":"wrong_exercise","trim_start":0,"trim_end":null,"reasoning_summary":"A chest press is not a pec-deck fly.","review_checklist":{"correct_exercise":false,"compatible_equipment":false,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":false,"useful_framing":false,"no_blocking_elements":false,"license_confirmed":true,"references_verified":true,"validation_version":"1.5","validation_score":42,"exercise_match":"RELATED_BUT_DIFFERENT"}},{"candidate_id":"10a8bfbd07151982","exercise_slug":"farmer-walk","source_url":"https://commons.wikimedia.org/wiki/File:Kettlebell_Farmer_Walks.webm","decision":"REJECT","target_status":"rejected","execution_quality":"approved","recommended_role":null,"validation_score":74,"exercise_match":"RELATED_BUT_DIFFERENT","rejection_reason":"wrong_exercise","trim_start":0,"trim_end":null,"reasoning_summary":"Unilateral suitcase carry has different anti-lateral-flexion demands than the bilateral farmer carry catalog entry.","review_checklist":{"correct_exercise":false,"compatible_equipment":false,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":false,"useful_framing":false,"no_blocking_elements":false,"license_confirmed":true,"references_verified":true,"validation_version":"1.5","validation_score":74,"exercise_match":"RELATED_BUT_DIFFERENT"}},{"candidate_id":"a1907022712c0865","exercise_slug":"bike","source_url":"https://commons.wikimedia.org/wiki/File:Man_on_an_Exercise_Bike_GIF_Animation_Loop.gif","decision":"APPROVE","target_status":"reviewing","execution_quality":"approved","recommended_role":"PRIMARY_DEMO","validation_score":95,"exercise_match":"EXACT","rejection_reason":null,"trim_start":0,"trim_end":null,"reasoning_summary":"Exact stationary-bike activity with verified CC BY-SA 4.0 permission record.","review_checklist":{"correct_exercise":true,"compatible_equipment":true,"start_position_visible":true,"main_range_visible":true,"complete_repetition_visible":true,"technically_acceptable":true,"sufficient_clarity":true,"useful_framing":true,"no_blocking_elements":true,"license_confirmed":true,"references_verified":true,"validation_version":"1.5","validation_score":95,"exercise_match":"EXACT"}}]$r5_validation$::jsonb) as candidate(
  candidate_id text,
  exercise_slug text,
  source_url text,
  decision text,
  target_status text,
  execution_quality text,
  recommended_role text,
  validation_score integer,
  exercise_match text,
  rejection_reason text,
  trim_start numeric,
  trim_end numeric,
  reasoning_summary text,
  review_checklist jsonb
);

create temporary table r5_baseline_identity on commit drop as
select * from jsonb_to_recordset($r5_baseline$[{"exercise_slug":"bike","source_url":"https://commons.wikimedia.org/wiki/File:Man_on_an_Exercise_Bike.webm"},{"exercise_slug":"calf-raise","source_url":"https://commons.wikimedia.org/wiki/File:Donkey_Calf_Raise.webm"},{"exercise_slug":"calf-raise","source_url":"https://commons.wikimedia.org/wiki/File:Rocking_Standing_Calf_Raise.webm"},{"exercise_slug":"calf-raise","source_url":"https://commons.wikimedia.org/wiki/File:Seated_Calf_Raise.webm"},{"exercise_slug":"calf-raise","source_url":"https://commons.wikimedia.org/wiki/File:Single_Leg_Calf_Raise.webm"},{"exercise_slug":"calf-raise","source_url":"https://commons.wikimedia.org/wiki/File:Smith_Machine_Calf_Raise.webm"},{"exercise_slug":"farmer-walk","source_url":"https://commons.wikimedia.org/wiki/File:Kettlebell_Farmer_Walks.webm"},{"exercise_slug":"goblet-squat","source_url":"https://commons.wikimedia.org/wiki/File:Kettlebell_Goblet_Squat.webm"},{"exercise_slug":"goblet-squat","source_url":"https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_Home_-_Half_squat.webm"},{"exercise_slug":"goblet-squat","source_url":"https://commons.wikimedia.org/wiki/File:Squat-CDC_strength_training_for_older_adults.gif"},{"exercise_slug":"hack-squat","source_url":"https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_Home_-_Half_squat.webm"},{"exercise_slug":"hack-squat","source_url":"https://commons.wikimedia.org/wiki/File:Squat-CDC_strength_training_for_older_adults.gif"},{"exercise_slug":"incline-machine-press","source_url":"https://commons.wikimedia.org/wiki/File:Incline_Bench_Press.webm"},{"exercise_slug":"incline-machine-press","source_url":"https://commons.wikimedia.org/wiki/File:Incline_Dumbbell_Press.webm"},{"exercise_slug":"incline-machine-press","source_url":"https://commons.wikimedia.org/wiki/File:Incline_Press_-_Exercise_Demonstration.webm"},{"exercise_slug":"lat-pulldown","source_url":"https://commons.wikimedia.org/wiki/File:Close-grip_Lat_Pull_Down.webm"},{"exercise_slug":"lat-pulldown","source_url":"https://commons.wikimedia.org/wiki/File:Close-Grip_Pulldown_-_Exercise_Demonstration.webm"},{"exercise_slug":"lat-pulldown","source_url":"https://commons.wikimedia.org/wiki/File:Common_Lat_Pulldown_Mistakes.webm"},{"exercise_slug":"lat-pulldown","source_url":"https://commons.wikimedia.org/wiki/File:Wide-grip_Lat_Pull_Down.webm"},{"exercise_slug":"leg-extension","source_url":"https://commons.wikimedia.org/wiki/File:Knee_extension-CDC_strength_training_for_older_adults.gif"},{"exercise_slug":"leg-extension","source_url":"https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Leg_Extension.webm"},{"exercise_slug":"leg-press","source_url":"https://commons.wikimedia.org/wiki/File:Exercisingwithmoderntech.gif"},{"exercise_slug":"leg-press","source_url":"https://commons.wikimedia.org/wiki/File:How_to_properly_leg_press.webm"},{"exercise_slug":"leg-press","source_url":"https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Seated_Leg_Press.webm"},{"exercise_slug":"leg-press","source_url":"https://commons.wikimedia.org/wiki/File:Squat-CDC_strength_training_for_older_adults.gif"},{"exercise_slug":"lying-leg-curl","source_url":"https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Leg_Curl.webm"},{"exercise_slug":"machine-chest-press","source_url":"https://commons.wikimedia.org/wiki/File:Bench_Press_-_Exercise_Demonstration.webm"},{"exercise_slug":"machine-chest-press","source_url":"https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Chest_Press.webm"},{"exercise_slug":"machine-fly","source_url":"https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Chest_Press.webm"},{"exercise_slug":"machine-row","source_url":"https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Row_Machine.webm"},{"exercise_slug":"machine-shoulder-press","source_url":"https://commons.wikimedia.org/wiki/File:Shoulder_Press_-_Exercise_Demonstration.webm"},{"exercise_slug":"machine-shoulder-press","source_url":"https://commons.wikimedia.org/wiki/File:Shoulder_Press.webm"},{"exercise_slug":"neutral-pulldown","source_url":"https://commons.wikimedia.org/wiki/File:Common_Lat_Pulldown_Mistakes.webm"},{"exercise_slug":"seated-leg-curl","source_url":"https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Leg_Curl.webm"},{"exercise_slug":"seated-row","source_url":"https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Row_Machine.webm"},{"exercise_slug":"smith-squat","source_url":"https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_Home_-_Half_squat.webm"},{"exercise_slug":"smith-squat","source_url":"https://commons.wikimedia.org/wiki/File:Squat-CDC_strength_training_for_older_adults.gif"},{"exercise_slug":"supinated-pulldown","source_url":"https://commons.wikimedia.org/wiki/File:Common_Lat_Pulldown_Mistakes.webm"},{"exercise_slug":"thoracic-extension","source_url":"https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_Home_-_Chest_Stretch.webm"},{"exercise_slug":"thoracic-extension","source_url":"https://commons.wikimedia.org/wiki/File:Upper_back_extension-CDC_strength_training_for_older_adults.gif"}]$r5_baseline$::jsonb) as candidate(
  exercise_slug text,
  source_url text
);

do $$
declare
  target_count integer;
  baseline_count integer;
  expected_before_count integer;
begin
  if (select count(*) from public.exercise_media where status = 'approved') <> 0
     or (select count(*) from public.exercise_media where is_primary) <> 0
     or (select count(*) from public.exercises where active) <> 0 then
    raise exception 'R5 preflight failed: approved, PRIMARY, and active counts must be zero';
  end if;
  select case when bike_was_present then 41 else 40 end
    into expected_before_count from r5_reconciliation_context;
  if (select before_count from r5_reconciliation_context) <> expected_before_count then
    raise exception 'R5 preflight failed: candidate baseline drifted from the audited 40 rows plus optional reconciled bike';
  end if;
  select count(*) into baseline_count
  from r5_baseline_identity baseline
  join public.exercises exercise on exercise.slug = baseline.exercise_slug
  join public.exercise_media media
    on media.exercise_id = exercise.id and media.source_url = baseline.source_url;
  if baseline_count <> 40 then
    raise exception 'R5 preflight failed: expected all 40 audited baseline identities, got %', baseline_count;
  end if;
  select count(*) into target_count
  from r5_validation_payload payload
  join public.exercises exercise on exercise.slug = payload.exercise_slug
  join public.exercise_media media
    on media.exercise_id = exercise.id and media.source_url = payload.source_url;
  if target_count <> (case when (select bike_was_present from r5_reconciliation_context) then 24 else 23 end) then
    raise exception 'R5 preflight failed: validation identity presence does not match bike reconciliation state (got %)', target_count;
  end if;
end;
$$;

with candidate as (
  select * from jsonb_to_record($r5_bike${"exercise_slug":"bike","media_type":"gif","source_url":"https://commons.wikimedia.org/wiki/File:Man_on_an_Exercise_Bike_GIF_Animation_Loop.gif","original_file_url":"https://upload.wikimedia.org/wikipedia/commons/a/ad/Man_on_an_Exercise_Bike_GIF_Animation_Loop.gif?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original","source_name":"Wikimedia Commons","source_type":"creative_commons","license_code":"CC-BY-SA-4.0","license_url":"https://creativecommons.org/licenses/by-sa/4.0/","author":"VideoPlasty","attribution_text":"“Man on an Exercise Bike GIF Animation Loop.gif”. Autor: VideoPlasty. Licença: CC BY-SA 4.0. Fonte: Wikimedia Commons.","attribution_required":true,"width":75,"height":100,"duration_seconds":null,"file_size_bytes":null,"match_score":100,"match_details":{"exactCanonical":true,"exactAlias":true,"matchedAlias":"exercise bike","titleTokenScore":10,"equipmentExact":false,"equipmentCompatible":false,"wrongEquipment":false,"movementPattern":true,"muscle":false,"relevantCategory":false,"demoKeyword":true,"cdcSource":false,"differentSubtype":false,"ambiguousTitle":false,"nonExercise":false,"video":true,"positiveReasons":["canonical name","alias: exercise bike","title overlap: 10/25","movement: cardio","exercise/demo keyword","video media"],"negativeReasons":[]},"candidate_metadata":{"title":"Man on an Exercise Bike GIF Animation Loop.gif","description":"A man wearing a blue t-shirt, green shorts and a blue headband is sweating like crazy on an exercise bike","confidence":"strong","categories":[],"date":"2018-03-05","mime":"image/gif"}}$r5_bike$::jsonb) as value(
    exercise_slug text,
    media_type text,
    source_url text,
    original_file_url text,
    source_name text,
    source_type text,
    license_code text,
    license_url text,
    author text,
    attribution_text text,
    attribution_required boolean,
    width integer,
    height integer,
    duration_seconds numeric,
    file_size_bytes bigint,
    match_score integer,
    match_details jsonb,
    candidate_metadata jsonb
  )
)
insert into public.exercise_media(
  exercise_id, media_type, storage_path, angle, status, media_role,
  execution_quality, source_name, source_type, source_url, original_file_url,
  license_code, license_url, author, attribution_text, attribution_required,
  width, height, duration_seconds, file_size_bytes, match_score, match_details,
  candidate_metadata, is_primary, ready_for_processing
)
select
  exercise.id, candidate.media_type, null, 'main', 'pending', null,
  'unreviewed', candidate.source_name, candidate.source_type,
  candidate.source_url, candidate.original_file_url, candidate.license_code,
  candidate.license_url, candidate.author, candidate.attribution_text,
  candidate.attribution_required, candidate.width, candidate.height,
  candidate.duration_seconds, candidate.file_size_bytes, candidate.match_score,
  candidate.match_details, candidate.candidate_metadata, false, false
from candidate
join public.exercises exercise on exercise.slug = candidate.exercise_slug
on conflict(exercise_id, source_url) do nothing;

update public.exercise_media media
set
  status = payload.target_status,
  media_role = null,
  is_primary = false,
  ready_for_processing = false,
  execution_quality = payload.execution_quality,
  review_checklist = payload.review_checklist,
  review_notes = '[v1.5 ' || payload.decision || '] ' || payload.reasoning_summary,
  rejection_reason = payload.rejection_reason,
  reviewed_at = coalesce(media.reviewed_at, now()),
  trim_start = payload.trim_start,
  trim_end = payload.trim_end,
  candidate_metadata = media.candidate_metadata || jsonb_build_object(
    'validation', jsonb_build_object(
      'version', '1.5',
      'decision', payload.decision,
      'recommendedRole', payload.recommended_role,
      'validationScore', payload.validation_score,
      'exerciseMatch', payload.exercise_match
    )
  )
from r5_validation_payload payload
join public.exercises exercise on exercise.slug = payload.exercise_slug
where media.exercise_id = exercise.id and media.source_url = payload.source_url;

insert into public.media_review_events(
  media_id, action, from_status, to_status, notes, metadata
)
select
  media.id,
  case when payload.decision = 'REJECT' then 'rejected' else 'review_started' end,
  'pending',
  payload.target_status,
  'VM Training semantic media reconciliation v1.6.1-R5 / validation v1.5',
  jsonb_build_object(
    'candidate_id', payload.candidate_id,
    'validation_version', '1.5',
    'validation_score', payload.validation_score,
    'exercise_match', payload.exercise_match,
    'decision', payload.decision,
    'recommended_role', payload.recommended_role,
    'reconciliation_version', '1.6.1-R5'
  )
from r5_validation_payload payload
join public.exercises exercise on exercise.slug = payload.exercise_slug
join public.exercise_media media
  on media.exercise_id = exercise.id and media.source_url = payload.source_url
where not exists (
  select 1 from public.media_review_events event
  where event.media_id = media.id
    and event.metadata @> jsonb_build_object(
      'validation_version', '1.5',
      'reconciliation_version', '1.6.1-R5'
    )
);

do $$
declare
  expected_count integer;
  actual_count integer;
begin
  select before_count + case when bike_was_present then 0 else 1 end
    into expected_count from r5_reconciliation_context;
  select count(*) into actual_count from public.exercise_media;
  if actual_count <> expected_count then
    raise exception 'R5 candidate count mismatch: expected %, got %', expected_count, actual_count;
  end if;
  if (select count(*) from r5_validation_payload payload
      join public.exercises exercise on exercise.slug = payload.exercise_slug
      join public.exercise_media media
        on media.exercise_id = exercise.id and media.source_url = payload.source_url) <> 24 then
    raise exception 'R5 validation identity reconciliation did not reach 24/24 target rows';
  end if;
  if (select count(*) from public.media_review_events
      where metadata @> '{"validation_version":"1.5","reconciliation_version":"1.6.1-R5"}'::jsonb) <> 24 then
    raise exception 'R5 audit event reconciliation did not reach 24/24';
  end if;
  if (select count(*) from public.exercise_media where status = 'approved') <> 0
     or (select count(*) from public.exercise_media where is_primary) <> 0
     or (select count(*) from public.exercise_media where media_role = 'PRIMARY_DEMO') <> 0
     or (select count(*) from public.exercises where active) <> 0 then
    raise exception 'R5 safety invariant failed: no approval, PRIMARY, or activation allowed';
  end if;
  if (select count(*) from storage.objects where bucket_id = 'exercise-media') <>
     (select before_storage_count from r5_reconciliation_context) then
    raise exception 'R5 safety invariant failed: Storage object count changed';
  end if;
  if exists(
    select 1 from public.exercise_media
    group by exercise_id, source_url having count(*) > 1
  ) then
    raise exception 'R5 duplicate candidate identity detected';
  end if;
end;
$$;

commit;
