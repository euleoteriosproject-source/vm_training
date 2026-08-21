# Production Media Dataset Reconciliation v1.6.1-R5 PREP

Status: `READY_FOR_SEMANTIC_MEDIA_RECONCILIATION`

Production project: `inghftngeritrsezwxnm`

This is a review-only preparation artifact. Production writes, Storage uploads, media publication, exercise activation, migrations, and grant changes performed by R5 PREP: **0**.

## Authority and scope

Raw Media Discovery v1.2 is candidate discovery evidence, not semantic truth. A high discovery score or an identity missing from Production does not prove that an exercise association is correct. The reconciliation authority is, in order:

1. Media Validation v1.5;
2. Media Processing v1.6 for the seven validated PRIMARY source assets;
3. verified license evidence;
4. raw Discovery v1.2;
5. current Production candidates that have not yet received semantic validation.

The candidate library and approved media library remain separate. The schema supports rejected state plus `media_review_events`, so a rejected candidate can retain audit history without being approved, published, primary, or active. A missing rejected discovery association does not need to be inserted merely to create raw 40/40 parity.

Canonical identity is `exerciseSlug + normalized sourceUrl`. Normalization lowercases only URL scheme and host, removes fragments and known tracking parameters (`utm_*`, `fbclid`, `gclid`), and sorts remaining query parameters. It does not alter path case or collapse different Wikimedia files. Identity establishes which candidate is being discussed; it does not establish semantic validity.

## Read-only Production snapshot

The R5 snapshot was captured with SELECT-only introspection after confirming the linked project ref.

| Metric | Value |
| --- | ---: |
| Migration history | 18/18 aligned |
| Candidates | 40 |
| Pending | 40 |
| Approved | 0 |
| PRIMARY | 0 |
| Active exercises | 0 |
| `exercise-media` Storage objects | 0 |

The versioned crosswalk contains only the requested safe candidate fields. It contains no environment values, credentials, database password, access token, or Supabase secret key.

## Validation v1.5 results

All 40 records were loaded and counted from the artifact itself:

| Decision | Count |
| --- | ---: |
| PRIMARY recommendations (`APPROVE`, exact) | 7 |
| Rejected | 31 |
| Pending manual/license review | 2 |

The pending records are:

- `leg-press` / `How to properly leg press.webm`: exact educational material, score 88, license review unresolved;
- `lat-pulldown` / `Common Lat Pulldown Mistakes.webm`: exact educational material, score 88, license review unresolved.

Both remain pending in the proposed state. Neither is converted to approved or rejected.

## Exact validated PRIMARY source candidates

All seven records agree across Media Validation v1.5, Media Processing v1.6, and the primary manifest. `PRIMARY_DEMO` below is a recommendation retained in audit metadata only; R5 does not assign the database role.

| Exercise | Source title | License | v1.5 | Production | Processed GIF SHA-256 | Poster SHA-256 |
| --- | --- | --- | --- | --- | --- | --- |
| `leg-press` | `Muscle Strengthening at the Gym - Seated Leg Press.webm` | PD | APPROVE / EXACT / 96 | PRESENT | `cf32752060a224e80d167f096331205841e7ddc4ec4b7d421da7883aecffff7d` | `54340788fd2c6d102cb962ec185209eec1a55db32c6f4871d5c4fa022abf142b` |
| `goblet-squat` | `Kettlebell Goblet Squat.webm` | CC-BY-SA-4.0 | APPROVE / EXACT / 98 | PRESENT | `2fe6026ca687c84ef2a1f0e3587b8aa17dfab101c5210aa3a2c2c9450a9f9a37` | `d91a9d685315fea32ff9542d34ecefc6bc074b8a04915d983c78b42646af3281` |
| `leg-extension` | `Muscle Strengthening at the Gym - Leg Extension.webm` | PD | APPROVE / EXACT / 97 | PRESENT | `9c69c89d9099661a4babd219bc9b57b95140edbbcb002f83cb5b93d572543493` | `92d4107f372072eedadd9cde3b35cf6576e32e1f762c172840e03f32c29ec796` |
| `seated-leg-curl` | `Muscle Strengthening at the Gym - Leg Curl.webm` | PD | APPROVE / EXACT / 96 | PRESENT | `45a0cc51ebe9cc07eb94b14fae1ddd1a9d80d14e3ddaac7fcc26f88785054cf0` | `8f7d2f32f32814c5b7831286897475cec21d0c690b08a1d1474ba838a6e214dc` |
| `machine-row` | `Muscle Strengthening at the Gym - Row Machine.webm` | PD | APPROVE / EXACT / 96 | PRESENT | `c3b427f6c66bacd1818062e02aa377f8eb28104f195f8fbc399fcaeae921644b` | `9e5af756b78891d8a5d47a4527d49aaa779e251aebc8f57cdc424961707f1c0c` |
| `machine-chest-press` | `Muscle Strengthening at the Gym - Chest Press.webm` | PD | APPROVE / EXACT / 97 | PRESENT | `c9f99ca69a26c888b87953e95ef9b1c3d4be12037b13ed207671d4a41ba4912d` | `e24a5dbca51b72153a6a7bf0fef32d033378d953d94853b871e6bf8cf69134c4` |
| `bike` | `Man on an Exercise Bike GIF Animation Loop.gif` | CC-BY-SA-4.0 | APPROVE / EXACT / 95 | MISSING | `0d529456a570dc3d9bdd6526d1205184441c26e6ee7752269d9138990860e77a` | `0abf596d9f39bb7548e837d4e4976d38b3ee594dc5a72bee8ffeef25987bb6c8` |

Result: 6 present, 1 missing, 0 conflicts.

## Previous 17 missing raw-discovery identities

The word “missing” describes set membership only. Validation produces the semantic disposition:

| Disposition | Count | Proposed treatment |
| --- | ---: | --- |
| `NEEDED_FOR_PRIMARY` | 1 | Add the validated bike GIF source candidate |
| `KNOWN_REJECT` | 13 | Keep the v1.5 rejection in versioned audit evidence; do not insert |
| `BAD_DISCOVERY_ASSOCIATION` | 3 | Keep rejection evidence locally; do not insert the incorrect association |
| `PENDING_MANUAL` | 0 | None |
| `OPTIONAL_CANDIDATE` | 0 | None |

Details:

| Exercise | Candidate | v1.5 | Semantic disposition |
| --- | --- | --- | --- |
| `bike` | `Man on an Exercise Bike GIF Animation Loop.gif` | APPROVE / EXACT | NEEDED_FOR_PRIMARY |
| `calf-raise` | `Rocking-standing-calf-raise-1.gif` | REJECT / EXACT | KNOWN_REJECT |
| `calf-raise` | `Rocking-standing-calf-raise-2.gif` | REJECT / EXACT | KNOWN_REJECT |
| `calf-raise` | `Seated-calf-raise-1.gif` | REJECT / RELATED_BUT_DIFFERENT | KNOWN_REJECT |
| `calf-raise` | `Standing-barbell-calf-raise-1.gif` | REJECT / EXACT | KNOWN_REJECT |
| `calf-raise` | `Standing-barbell-calf-raise-2.gif` | REJECT / EXACT | KNOWN_REJECT |
| `lat-pulldown` | `Wide-grip-lat-pull-down-1.gif` | REJECT / EXACT | KNOWN_REJECT |
| `lat-pulldown` | `Wide-grip-lat-pull-down-2.gif` | REJECT / EXACT | KNOWN_REJECT |
| `lat-pulldown` | `How to properly leg press.webm` | REJECT / INCORRECT | BAD_DISCOVERY_ASSOCIATION |
| `machine-chest-press` | `Chest press-CDC strength training for older adults.gif` | REJECT / RELATED_BUT_DIFFERENT | KNOWN_REJECT |
| `incline-machine-press` | `Incline press - exercise demonstration video.webm` | REJECT / RELATED_BUT_DIFFERENT | KNOWN_REJECT |
| `incline-machine-press` | `Muscle Strengthening at the Gym - Chest Press.webm` | REJECT / RELATED_BUT_DIFFERENT | KNOWN_REJECT |
| `incline-machine-press` | `Chest press-CDC strength training for older adults.gif` | REJECT / RELATED_BUT_DIFFERENT | KNOWN_REJECT |
| `machine-shoulder-press` | `Shoulder press - exercise demonstration video.webm` | REJECT / RELATED_BUT_DIFFERENT | KNOWN_REJECT |
| `machine-shoulder-press` | `How To Properly Dumbbell Shoulder Press.webm` | REJECT / RELATED_BUT_DIFFERENT | KNOWN_REJECT |
| `thoracic-extension` | `Chest stretch-CDC strength training for older adults.gif` | REJECT / INCORRECT | BAD_DISCOVERY_ASSOCIATION |
| `thoracic-extension` | `Hamstring stretch-CDC strength training for older adults.gif` | REJECT / INCORRECT | BAD_DISCOVERY_ASSOCIATION |

## Previous 17 Production-only identities

Absence from v1.2 is not proof of invalidity. No exact duplicate, corrupted row, or impossible association was proven strongly enough to delete in PREP.

| Exercise | Candidate | Classification | Action |
| --- | --- | --- | --- |
| `bike` | `Man on an Exercise Bike.webm` | USEFUL_UNREVIEWED | KEEP_UNREVIEWED |
| `calf-raise` | `Donkey Calf Raise.webm` | USEFUL_UNREVIEWED | KEEP_UNREVIEWED |
| `calf-raise` | `Rocking Standing Calf Raise.webm` | USEFUL_UNREVIEWED | KEEP_UNREVIEWED |
| `calf-raise` | `Seated Calf Raise.webm` | USEFUL_UNREVIEWED | KEEP_UNREVIEWED |
| `calf-raise` | `Single Leg Calf Raise.webm` | USEFUL_UNREVIEWED | KEEP_UNREVIEWED |
| `calf-raise` | `Smith Machine Calf Raise.webm` | USEFUL_UNREVIEWED | KEEP_UNREVIEWED |
| `lat-pulldown` | `Close-Grip Pulldown - Exercise Demonstration.webm` | USEFUL_UNREVIEWED | KEEP_UNREVIEWED |
| `lat-pulldown` | `Close-grip Lat Pull Down.webm` | USEFUL_UNREVIEWED | KEEP_UNREVIEWED |
| `lat-pulldown` | `Wide-grip Lat Pull Down.webm` | USEFUL_UNREVIEWED | KEEP_UNREVIEWED |
| `machine-shoulder-press` | `Shoulder Press.webm` | USEFUL_UNREVIEWED | KEEP_UNREVIEWED |
| `machine-shoulder-press` | `Shoulder Press - Exercise Demonstration.webm` | USEFUL_UNREVIEWED | KEEP_UNREVIEWED |
| `thoracic-extension` | `Upper back extension-CDC strength training for older adults.gif` | USEFUL_UNREVIEWED | KEEP_UNREVIEWED |
| `incline-machine-press` | `Incline Bench Press.webm` | equipment mismatch risk | MANUAL_REVIEW |
| `incline-machine-press` | `Incline Dumbbell Press.webm` | equipment mismatch risk | MANUAL_REVIEW |
| `incline-machine-press` | `Incline Press - Exercise Demonstration.webm` | equipment mismatch risk | MANUAL_REVIEW |
| `machine-chest-press` | `Bench Press - Exercise Demonstration.webm` | bench press is not machine chest press | MANUAL_REVIEW |
| `thoracic-extension` | `Muscle Strengthening at Home - Chest Stretch.webm` | stretch is not established as thoracic extension | MANUAL_REVIEW |

Totals: 12 `KEEP_UNREVIEWED`, 5 `MANUAL_REVIEW`, 0 `REMOVE_DUPLICATE`, 0 `REMOVE_INVALID`.

## Critical semantic checks

### Lat pulldown / leg press defect

`lat-pulldown + How to properly leg press.webm` was classified by v1.5 as `REJECT`, `INCORRECT`, execution quality `rejected`, score 5, with unresolved license review. The source title, description, and [Wikimedia file page](https://commons.wikimedia.org/wiki/File:How_to_properly_leg_press.webm) identify a leg press, not a lat pulldown. It must not be inserted under `lat-pulldown`. The rejected local validation record remains the audit evidence that prevents rediscovery.

The same source URL under `leg-press` is a distinct canonical identity and was classified `KEEP_PENDING`, exact educational content, score 88. That association remains pending because license review is unresolved.

### Bike

The authoritative processed source is [Man on an Exercise Bike GIF Animation Loop.gif](https://commons.wikimedia.org/wiki/File:Man_on_an_Exercise_Bike_GIF_Animation_Loop.gif), and all three local authority artifacts agree. Production currently has `Man on an Exercise Bike.webm`, a separate candidate identity. The target is:

- add the validated GIF source as pending/reviewing, with no media role or publication;
- keep the WebM as useful unreviewed evidence;
- remove neither candidate;
- defer role assignment and Storage publishing to the later server-only pipeline.

### Machine chest press

The validated PRIMARY source is [Muscle Strengthening at the Gym - Chest Press.webm](https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Chest_Press.webm), classified APPROVE / EXACT by v1.5. A generic bench press is not treated as equivalent to a machine chest press and stays in manual review. The alternate CDC GIF rejected by v1.5 is not inserted merely for raw parity.

### Seated leg curl

The validated PRIMARY is [Muscle Strengthening at the Gym - Leg Curl.webm](https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_the_Gym_-_Leg_Curl.webm) under `seated-leg-curl`, APPROVE / EXACT / 96. The same source under `lying-leg-curl` was REJECT / INCORRECT / 48 because the demonstrated body position is seated, not lying.

### Other known validation defects

- `machine-fly` mapped to chest press: REJECT / RELATED_BUT_DIFFERENT;
- `farmer-walk` mapped to unilateral suitcase carry: REJECT / RELATED_BUT_DIFFERENT;
- `thoracic-extension` mapped to hamstring stretch: REJECT / INCORRECT;
- `hack-squat` mapped to half/bodyweight squat: REJECT / RELATED_BUT_DIFFERENT because the defining equipment is absent.

## Crosswalk and proposed target

The crosswalk union contains 57 identities:

| Metric | Count |
| --- | ---: |
| Local Validation candidates | 40 |
| Current Production candidates | 40 |
| Exact overlap | 23 |
| Previous local-only (“missing”) | 17 |
| Production-only (“unexpected”) | 17 |
| Validated PRIMARY present | 6 |
| Validated PRIMARY missing | 1 |

Proposed database target:

| Operation | Count |
| --- | ---: |
| Current | 40 |
| Add | 1 |
| Keep existing | 40 |
| Remove | 0 |
| Final | 41 |

The single addition is the validated bike GIF source candidate. All 17 Production-only rows are retained: 12 as useful unreviewed candidates and 5 for manual review. There is no arbitrary 40-row requirement.

Of the 40 v1.5 decisions, 24 have or would have a Production candidate after the bike addition: 7 PRIMARY recommendations, 15 rejections, and 2 pending decisions. A future R5 apply can safely synchronize those 24 decisions selectively. The seven PRIMARY recommendations become `reviewing`, never `approved`; the recommended role is recorded only inside validation/audit metadata. The 15 present rejections become `rejected` with audit events. The two pending records remain `pending`. The 16 rejected identities absent from Production are not inserted.

## Proposed apply artifact

File: `ops/production/proposed-media-reconciliation-v161-r5.sql`

The proposal is atomic and idempotent:

- one `BEGIN` / `COMMIT` transaction;
- strict preflight requires all 40 audited baseline identities and allows only the optional already-reconciled bike as row 41;
- exact joins use exercise slug plus source URL;
- bike insertion uses the existing `(exercise_id, source_url)` uniqueness constraint with `ON CONFLICT DO NOTHING`;
- 24 validation decisions are synchronized without approval, PRIMARY assignment, processing readiness, activation, or Storage mutation;
- v1.5/R5 audit events use an idempotency key in event metadata;
- postconditions assert candidate count, 24/24 target identities, 24/24 audit events, no duplicate identity, no approved/PRIMARY/active state, and unchanged Storage object count;
- no `DELETE` exists in the proposal.

This file was generated for review and was **not** executed against Production.

## Local simulation and verification

The current 40-row Production candidate identity set was reproduced inside a local PostgreSQL transaction. The proposed body produced:

```json
{"active":0,"events":24,"pending":19,"primary":0,"storage":14,"approved":0,"rejected":15,"reviewing":7,"candidates":41}
```

The local environment already contained 14 media objects from previous local-only processing. The simulation asserted that this count did not change. It ended in `ROLLBACK`; a follow-up read confirmed restoration to 40 media rows, 47 prior events, 7 prior local active exercises, and 14 Storage objects.

| Check | Result |
| --- | --- |
| Lint | PASS |
| Typecheck | PASS |
| Unit | PASS — 45/45 |
| pgTAP | PASS — 62/62 |
| Primary manifest integrity | PASS — 7/7 GIF hashes and 7/7 poster hashes |
| Active-media verifier | PASS — 0/0 active target exercises, expected for current Production configuration |
| Build | PASS |

No E2E was run because R5 PREP changes no application or UI behavior.

## Gate

`READY_FOR_SEMANTIC_MEDIA_RECONCILIATION`

The next step requires an explicit, separately reviewed authorization. Do not execute Production reconciliation as part of PREP.
