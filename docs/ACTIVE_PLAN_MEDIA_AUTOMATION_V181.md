# VM Training v1.8.1 — Automated Active Plan Media Coverage

Date: 2026-08-23

Production project: `inghftngeritrsezwxnm`

Strategy: correctness over coverage, GIF-first, one exercise at a time

## Result

The active plan contains 18 unique exercises. Four already had an approved
`PRIMARY_DEMO`. Fourteen uncovered exercises were evaluated independently.
Only `machine-shoulder-press` satisfied every automatic-publication gate; the
resulting coverage is 5/18. Ambiguous, mismatched, or unlicensed media was not
published.

| exercise               | candidate found | license               | reference 1                | reference 2                              | match                        | execution                                | confidence | decision               | published                                                                                    | reason                                                                                                                                   |
| ---------------------- | --------------- | --------------------- | -------------------------- | ---------------------------------------- | ---------------------------- | ---------------------------------------- | ---------- | ---------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| face-pull              | no              | —                     | NASM Face Pull             | NASM Upper Back                          | inconclusive                 | not inspectable                          | LOW        | NO_CANDIDATE_FOUND     | no                                                                                           | No licensed dynamic source unambiguously showed the required cable-and-rope movement.                                                    |
| lat-pulldown           | yes             | CC-BY-3.0 review flag | Mayo Clinic Lat Pull-down  | PubMed grip study                        | exact pronated               | tutorial includes errors and corrections | MEDIUM     | MANUAL_REVIEW_REQUIRED | no                                                                                           | Movement matches, but the long tutorial format and unresolved license flag block automatic publication.                                  |
| neutral-pulldown       | yes             | CC-BY-3.0 review flag | NSCA Basics                | PubMed grip study                        | related, different grip      | pronated grip                            | HIGH       | REJECTED               | no                                                                                           | The source is visibly pronated, not neutral.                                                                                             |
| supinated-pulldown     | yes             | CC-BY-3.0 review flag | NSCA Basics                | PubMed grip study                        | related, different grip      | pronated grip                            | HIGH       | REJECTED               | The source is visibly pronated, not underhand.                                               |
| seated-row             | yes             | PD                    | ACE Seated Row             | Mayo Clinic Seated Row                   | related, different equipment | selectorized lever row                   | HIGH       | REJECTED               | The source represents the existing articulated machine row, not the catalog's low cable row. |
| one-arm-row            | no              | —                     | ACE Single-arm Row         | NASM Upper Back                          | inconclusive                 | not inspectable                          | LOW        | NO_CANDIDATE_FOUND     | no                                                                                           | No licensed dynamic source matched the catalog's supported unilateral dumbbell row.                                                      |
| reverse-fly            | no              | —                     | ACE Incline Reverse Fly    | ACE Kneeling Reverse Fly                 | inconclusive                 | not inspectable                          | LOW        | NO_CANDIDATE_FOUND     | no                                                                                           | No source passed movement and equipment identity checks.                                                                                 |
| machine-shoulder-press | yes             | PD                    | CDC/Wikimedia source       | ACE Seated Shoulder Press + Life Fitness | EXACT                        | approved                                 | HIGH       | AUTOMATED_VALIDATED    | yes                                                                                          | Exact seated machine press, institutional public-domain provenance, full repetition, and final GIF QA passed.                            |
| lateral-raise          | no              | —                     | ACE Lateral Raise          | ACE Shoulder Study                       | inconclusive                 | not inspectable                          | LOW        | NO_CANDIDATE_FOUND     | no                                                                                           | No licensed dynamic source passed identity and complete-repetition checks.                                                               |
| machine-fly            | yes             | PD                    | Life Fitness Pectoral Fly  | ACE Chest Press comparator               | wrong exercise               | chest press                              | HIGH       | REJECTED               | no                                                                                           | Returned assets use elbow extension rather than the fly/adduction arc.                                                                   |
| hip-thrust             | no              | —                     | NSCA Hip Thrust Variations | NSCA Glute Program Design                | inconclusive                 | not inspectable                          | LOW        | NO_CANDIDATE_FOUND     | no                                                                                           | No source simultaneously showed bench support, compatible load, full extension, and controlled return.                                   |
| machine-glute          | no              | —                     | ACE Glute Press            | NSCA Glute Program Design                | catalog semantics conflict   | not inspectable                          | LOW        | MANUAL_REVIEW_REQUIRED | no                                                                                           | Instructions describe hip extension while Production equipment points to an abductor machine. Catalog semantics must be corrected first. |
| farmer-walk            | yes             | CC-BY-SA-4.0          | ACE Farmer's Carry         | NSCA Loaded Carries                      | related, different loading   | unilateral suitcase carry                | HIGH       | REJECTED               | no                                                                                           | The catalog requires bilateral loading.                                                                                                  |
| dead-bug               | no              | —                     | Mayo Clinic Core Strength  | VM catalog contract                      | inconclusive                 | not inspectable                          | LOW        | NO_CANDIDATE_FOUND     | no                                                                                           | No licensed source clearly showed controlled contralateral supine extension.                                                             |

The complete URLs, evidence, hashes, and machine-readable decisions are in
`data/media/active-plan-media-v181.json`.

## Published artifact

- Exercise: `machine-shoulder-press`
- Source: _Muscle Strengthening at the Gym - Overhead Press_ (CDC, Public Domain, via Wikimedia Commons)
- Source crop: 18–26 seconds; one complete controlled repetition
- GIF: 320×240 without upscale, 8 seconds, 96 frames, 12.5 fps, loop enabled
- GIF size: 4,520,956 bytes
- GIF SHA-256: `a71ff463a30988ceac803a4d6ca81bee28f67966941c357f8c78d0d02ae402d8`
- Poster SHA-256: `ea8b0c96ee32a4b0d67b4494854b065408bba867e75bf00061675cc1286231e8`
- Width below the normal 480 px target is intentional: the 320 px source was not upscaled.

The file was inspected first as source contact sheets, then again after the
final trim and GIF conversion. The visible machine, movement direction,
starting position, range, and complete repetition match both the seated
shoulder-press reference and the machine manufacturer's movement geometry.

## Automated publication architecture

Migration `20260823031216_automated_media_review_v181.sql` adds explicit review
state and provenance without assigning a human UUID to an automated action.
Automatic publication requires `HIGH` confidence and all 13 validation checks.

`private.publish_validated_exercise_media_automated` is a `SECURITY DEFINER`
function with an empty `search_path`. It is not in a Data API exposed schema;
only `service_role` receives schema usage and function execution. Publication
writes a non-human audit event and never changes `exercises.active` or a workout
plan.

The Admin review screen defaults to `MANUAL_REVIEW_REQUIRED` and separates
automatically published, rejected, and all records into explicit tabs.

## Verification

- Deterministic local processing and dry-run: PASS, zero writes
- Unit and media integrity: 71/71 PASS
- pgTAP security and database contracts: 125/125 PASS
- Remote Storage GIF/poster SHA-256: PASS after download from the private bucket
- Production schema and automated publication: PASS
- Application build: PASS
- Relevant E2E: 20 PASS in mobile/desktop; 2 local media scenarios skipped
  because the disposable local seed intentionally contains no approved Storage artifacts
- Browser verification: PASS on desktop loopback and mobile LAN, with no
  console errors, framework overlay, blank content, or horizontal overflow

## Coverage gate

- PRIMARY before: 4/18
- PRIMARY added: 1
- PRIMARY final: 5/18
- Automatically approved: 1
- Manual review required: 2
- Rejected: 5
- No candidate found: 6

Gate: `PARTIAL_COVERAGE_COMPLETE`
