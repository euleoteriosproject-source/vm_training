# VM Training — v2.2.1 Guided Posture Hotfix

## Outcome

When the primary goal is `posture` and the user chooses a standard commercial
gym with `gym_first`, automatic plans now prioritize supported machine/cable
work and reject unsupported free-weight candidates that have high technical
complexity or less than high stability.

Generic mobility exercises no longer fill the posture corrective slot. A
posture corrective must use the `posture` or `core_anti_rotation` pattern; an
unnecessary or unavailable optional slot is pruned.

## Guided media added

Five existing catalog exercises received audited, animated primary media:

- `hack-squat`
- `lying-leg-curl`
- `seated-row`
- `incline-machine-press`
- `machine-fly`

The canonical dataset is `data/media/media-v22-guided-posture.json`. Its five
two-position source artifacts are versioned under
`data/media/assets/guided-posture-v22/`. Every artifact is a 6-second looping
GIF with 72 frames; source, output and poster hashes are pinned in the dataset.

The artwork is by Everkinetic, sourced from Wikimedia Commons under
CC BY-SA 3.0. The derivative animation and attribution preserve that license.

## Safety and publication

`public.publish_v22_guided_media(uuid,text)` is service-role-only,
`SECURITY DEFINER`, hash-bound, and delegates to the existing automated media
gate only after verifying review provenance, storage objects and content hash.
Browser roles cannot execute it.

## Exact production-profile preview

The read-only preview for the affected profile produced:

- 15 total slots
- 13 unique exercises
- 15 machine/cable slots
- 0 unsupported free-weight slots
- 0 bodyweight-floor slots
- 0 generic mobility/stretch slots
- `programQualityStatus = PASS`

The already active plan is preserved. The corrected selection is used when the
user explicitly previews and activates a new plan.

## Verification

- lint: PASS
- typecheck: PASS
- unit/component tests: 130/130 PASS
- E2E (mobile Chromium, WebKit and desktop Chromium): 51/51 PASS
- pgTAP: 336/336 PASS
- production build: PASS
- media dry-run: 5/5 reproducible, zero writes
- media publication: 5/5 uploaded, remote hashes verified and published
