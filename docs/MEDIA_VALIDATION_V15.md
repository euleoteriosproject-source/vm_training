# VM Training Media Validation v1.5

This report records the complete visual, technical, licensing, biomechanics and web-reference review of the v1.2 discovery artifact. Discovery scores were retained only as provenance and were not used as approval thresholds. Temporary originals, probes and 3x2 contact sheets remain under `.tmp/media-validation/` and are intentionally ignored by Git.

## Summary

| Metric | Count |
| --- | ---: |
| Total candidates | 40 |
| Reviewed | 40 |
| Exact matches | 15 |
| Acceptable variations | 0 |
| Related but different | 20 |
| Incorrect | 5 |
| Recommended PRIMARY_DEMO | 7 |
| Recommended EDUCATIONAL | 2 |
| Recommended ALTERNATIVE_VARIATION | 0 |
| Recommended rejected | 31 |
| Still pending | 2 |
| Exercises with a valid PRIMARY candidate | 7 |
| Exercises without a valid PRIMARY candidate | 13 |

Catalog coverage is 7/20 (35%). Plan-ready coverage remains 0/20: recommendations still require trim/transcode/poster/hash/storage/publish, and no Production write was attempted without a configured auditable Production mechanism.

## Second-pass PRIMARY_DEMO check

Each recommendation was re-evaluated against: “Would a novice understand the catalog exercise by watching only this asset?” The seven candidates below passed identity and source quality, subject to the stated processing step. Long CDC instructional sources must be reduced to a clean 4–12 second, silent excerpt before publication.

- **leg-press** — Muscle Strengthening at the Gym - Seated Leg Press.webm — Exact CDC public-domain demonstration; use a short, silent processed excerpt after frame-accurate trim selection.
- **goblet-squat** — Kettlebell Goblet Squat.webm — Exact, clearly visible exercise with verified CC BY-SA 4.0 permission record.
- **leg-extension** — Muscle Strengthening at the Gym - Leg Extension.webm — Exact CDC public-domain machine demonstration; process a short excerpt before publishing.
- **seated-leg-curl** — Muscle Strengthening at the Gym - Leg Curl.webm — Exact CDC public-domain demonstration; process a short excerpt before publishing.
- **machine-row** — Muscle Strengthening at the Gym - Row Machine.webm — Exact CDC public-domain demonstration; process a short excerpt before publishing.
- **machine-chest-press** — Muscle Strengthening at the Gym - Chest Press.webm — Exact CDC public-domain demonstration; process a short excerpt before publishing.
- **bike** — Man on an Exercise Bike GIF Animation Loop.gif — Exact stationary-bike activity with verified CC BY-SA 4.0 permission record.

## Pending manual/license review

- **leg-press** — How to properly leg press.webm: Technically relevant long-form education, but Wikimedia marks the video for license review; it cannot be approved.
- **lat-pulldown** — Common Lat Pulldown Mistakes.webm: Useful educational content, but Wikimedia flags the license for review, so approval is blocked.

## Consistency rules applied

- Exercise identity and defining equipment outrank movement-pattern similarity.
- A static start or end pose is not a complete demonstration.
- Seated and prone leg curls, cable and lever rows, presses and flies, and grip-specific pulldowns remain distinct.
- A declared Creative Commons label was not accepted when Wikimedia still showed license review pending.
- No candidate was written to Production during analysis; the JSON result is the review boundary for a later auditable apply step.

## Exercise reports

- [leg-press](./media-validation/exercises/leg-press.md)
- [hack-squat](./media-validation/exercises/hack-squat.md)
- [smith-squat](./media-validation/exercises/smith-squat.md)
- [goblet-squat](./media-validation/exercises/goblet-squat.md)
- [leg-extension](./media-validation/exercises/leg-extension.md)
- [lying-leg-curl](./media-validation/exercises/lying-leg-curl.md)
- [seated-leg-curl](./media-validation/exercises/seated-leg-curl.md)
- [calf-raise](./media-validation/exercises/calf-raise.md)
- [lat-pulldown](./media-validation/exercises/lat-pulldown.md)
- [neutral-pulldown](./media-validation/exercises/neutral-pulldown.md)
- [supinated-pulldown](./media-validation/exercises/supinated-pulldown.md)
- [seated-row](./media-validation/exercises/seated-row.md)
- [machine-row](./media-validation/exercises/machine-row.md)
- [machine-chest-press](./media-validation/exercises/machine-chest-press.md)
- [incline-machine-press](./media-validation/exercises/incline-machine-press.md)
- [machine-fly](./media-validation/exercises/machine-fly.md)
- [machine-shoulder-press](./media-validation/exercises/machine-shoulder-press.md)
- [farmer-walk](./media-validation/exercises/farmer-walk.md)
- [thoracic-extension](./media-validation/exercises/thoracic-extension.md)
- [bike](./media-validation/exercises/bike.md)
