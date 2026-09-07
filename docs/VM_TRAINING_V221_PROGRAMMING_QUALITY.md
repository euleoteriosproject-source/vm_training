# VM Training v2.2.1 — Smart Slot programming quality

## Outcome

v2.2.1 keeps the deterministic v2.2.0 personal-engine pipeline and adds an explicit programming-need layer between weekly architecture and exercise selection. Session size is now the result of required coverage plus valuable optional work, not a target that must always be filled.

## Decision pipeline

1. `ProfileNormalizer` produces the stable training profile.
2. `GoalStrategyEngine` defines goal-specific volume, repetition and rest policy.
3. `TrainingArchitectureEngine` defines the weekly split and day focus.
4. `ProgrammingNeedEngine` classifies each potential function: primary lower stimulus, push, pull, posterior chain, knee dominant, supporting volume, trunk stability, scapular control, conditioning or mobility.
5. `CoverageAnalysis` measures how much of that need the already-required week covers, including partial functional contribution from pulls, hinges and trunk patterns.
6. `SlotJustification` always keeps structural required slots and retains an optional slot only when its goal relevance and uncovered need exceed its time, fatigue and redundancy cost.
7. `PlanCompiler` applies hard eligibility constraints and ranks only candidates that match the slot function.
8. `ProgramQualityEngine` validates the complete week and rejects filler, unjustified corrective work, poor environment fit, missing functional coverage or inefficient sessions.

There is no random choice, exercise-name rule, paid AI or external recommendation service.

## Required and optional slots

For each day, the first structural functions are `REQUIRED`. Longer-duration capacity creates `OPTIONAL` candidates. Optional candidates are evaluated after the required week so the decision can account for real weekly coverage.

An optional slot persists only when `programmingValue >= minimumProgrammingValue`. Pruned slots remain in `generation_rationale.prunedSlots` for auditability. Selected slots persist their need, coverage state, requirement, programming value, estimated time, redundancy and justification in `generation_rationale.selectedSlots`.

This allows a 60-minute preference to produce fewer than six exercises when a sixth movement would only add low-value repetition. The duration remains a ceiling for safe, useful work—not a requirement to occupy every minute.

## Gym-first context

Hard compatibility and user preference remain authoritative. For a standard commercial gym, exact-pattern machine/cable options receive the strongest contextual preference, followed by free weights. A bodyweight floor movement receives a contextual penalty only when an eligible, media-ready, exact-pattern commercial-gym alternative exists.

An explicit user `like` preference remains stronger than the default environment preference. A wrong-function machine does not outrank a functionally correct free-weight or floor exercise.

## Posture behavior

The posture goal no longer creates a corrective slot merely because the selected goal is posture. Horizontal and vertical pulling, posterior-chain work and trunk-stability patterns contribute to functional posture coverage. Corrective work is eligible when that functional coverage is still unmet and the slot clears the value threshold.

Every selected exercise explanation references its movement need, role, goal and weekly context. Corrective explanations state the missing weekly function that justified the slot.

## Persistence and security

Migration `20260906213000_v221_programming_quality.sql` is additive and introduces only versioned preview/activation functions plus independent v2.2.1 quality checks. It does not add catalog columns or rewrite plans, workouts or history.

- Browser/API generation creates a `v2.2.1` draft through `create_plan_preview_v221`.
- Existing active plans are untouched while a preview is created.
- Activation remains an explicit, owner-only call through `activate_plan_v221`.
- Database validation recomputes media, equipment, eligibility, diversity, goal alignment and gym-first safety from persisted rows. Functional coverage and weekly balance replace the legacy fixed count of eight movement-pattern labels.
- The persisted selected-slot audit must match the actual number of plan items and contain complete need/justification data.
- `anon` and `service_role` do not receive access to the user-plan RPCs.
- v2.2.0 preview and activation remain available for existing drafts.

## Debugging

Run the read-only Production report with:

```powershell
node --env-file=.env.local --experimental-strip-types scripts/production/preview-v220-readonly.ts --goal=posture
```

Despite its historical filename, the script imports the current generator, prints the selected and pruned slot audit, verifies the expected Supabase project ref and performs no write. Successful output must end with `persisted: false` and `activated: false`.

## Regression coverage

Automated tests cover posture with and without a justified corrective need, exact-pattern gym versus floor selection, no-gym-alternative behavior, wrong-function machine rejection, explicit user preferences, complete metadata preference, valuable and low-value sixth slots, goal differentiation, explanations and determinism. The existing generator, preferences, persistent-exclusion, substitution, database ACL, RLS, E2E and build suites remain release gates.

## Known limitations and release gate

- Programming value is a deterministic heuristic, not a physiological measurement.
- Estimated slot time is a conservative planning estimate and may differ from actual user pace.
- A user can still explicitly prefer a floor exercise when it is safe and compatible.
- Human review is required for subjective coherence, especially exercise order, perceived redundancy and whether the shorter posture sessions feel complete.

Production migration and deployment do not by themselves satisfy the human UAT gate. No real user plan may be generated or activated automatically as part of release verification.
