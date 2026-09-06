# VM Training v2.2.0 — Personal Engine

## Architecture

The generator is deterministic and strategy-first:

1. `ProfileNormalizer` creates a stable programming profile.
2. `GoalStrategyEngine` defines volume, repetitions, rest and conditioning/mobility contribution.
3. `TrainingArchitectureEngine` chooses the weekly split and each day's purpose.
4. `TrainingSlotBuilder` creates functional slots before any exercise is considered.
5. Eligibility and ranking reuse the proven media, equipment, preference, goal and gym-first policies.
6. `PlanCompiler` evaluates at most 16 compatible candidates per slot with a beam capped at 100 states.
7. `ProgramQualityEngine` evaluates the complete week, not only isolated days.

There is no random selection, paid AI, external recommendation service, or exercise-name programming rule.

## Goal strategies

- Muscle gain prioritizes resistance work, stable commercial-gym options, moderate repetitions and useful weekly exposure.
- Strength prioritizes primary patterns, lower repetitions, longer rest and permits more free-weight compounds.
- Conditioning, cardio and body-composition goals reserve explicit conditioning slots while preserving a strength base.
- Mobility and posture reserve movement-quality slots without contaminating unrelated goals.
- General health balances strength, movement quality and conditioning.

At four and five sessions the weekly split changes with the goal. Frequency is not implemented as repetition of one template.

## Training slots and ordering

A `TrainingSlot` describes role, movement patterns, target muscles, priority, fatigue budget and technical-demand ceiling. Exercises are selected only after all weekly slots exist. Primary movements precede secondary and accessory work. The quality gate rejects a plan if a primary slot is buried after accessory fatigue.

Session duration maps to intentional complexity: 30/45/60/75/90 minutes produce 4/5/6/7/8 slots per day. Longer sessions add lower-priority accessory, isolation, core, conditioning or mobility functions according to the strategy.

## Ranking and whole-plan optimization

Hard filters remain authoritative: active, approved PRIMARY media, server eligibility, equipment/capability compatibility, movement attention and persistent avoid preferences. Ranking then considers goal suitability, slot pattern, muscle target, training role, experience, stability, technical complexity, recent exposure and gym style.

The compiler uses at most 16 candidates per slot and 100 partial programs per iteration. It penalizes exact and functional-family repetition and weekly imbalance, prevents duplicate exercises in one day, caps exact repetition when the catalog permits, and validates pairwise overlap after compilation. Stable IDs break ties, so reversed catalog input produces the same plan.

## Volume, frequency and progression

Prescriptions vary by role. Primary, secondary and accessory slots receive different set, repetition and rest policies. Weekly set volume and muscle exposure are reported in quality metrics. Explicit volume and frequency gates reject out-of-range resistance prescriptions, missing days, or empty training days.

Progression uses completed set history only:

- `PROGRESS`: repeated complete sessions reached the top of the prescribed range.
- `MAINTAIN`: execution is adequate but not yet consistently at the top.
- `REGRESS`: recent execution is materially below the prescribed minimum.
- `INSUFFICIENT_DATA`: fewer than two comparable completed sessions.

Recommendations are conservative and make no medical or guaranteed-outcome claim.

## Explainability and substitutions

Every generated exercise persists its slot role, exercise family, concise selection rationale and progression recommendation. The preview and workout-day UI expose “Por que este exercício?”. A workout-session snapshot preserves the original programming role when an exercise is substituted. Existing direct-equivalent, goal-aligned alternative, rebalance, undo and persistent-exclusion flows remain authoritative.

## Persistence and versioning

Migration `20260906163000_v220_personal_engine.sql` is additive. It does not rewrite existing plans or history. v2.2 previews are always drafts; activation is a distinct authenticated owner-only RPC. Activation re-runs v2.1.5 safety/media/gym gates plus v2.2 weekly balance, order, explainability and metadata gates. Existing v2.1.5 plans continue to use their original activation contract.

## Testing

Coverage includes strategies, goal/frequency architecture, duration, slot construction, bounded optimization, weekly balance, family repetition, volume, ordering, progression states, determinism, gym-first behavior and persistent avoid. pgTAP validates additive schema, ACL and session metadata snapshots. Existing unit, pgTAP and E2E suites remain regression gates.

## Generator debug report

`node --env-file=.env.local --experimental-strip-types scripts/production/preview-v220-readonly.ts` produces the developer-readable admin report: profile inputs, weekly architecture, every slot/exercise/reason, progression state, pattern and muscle distribution, volume, equipment, diversity, order and media coverage. The script pins the expected Production project ref, performs only reads, and explicitly reports `persisted: false` and `activated: false`.

## Known limitations

- The fatigue model is deliberately lightweight; it prevents obvious ordering errors but does not claim physiological precision.
- Progression requires comparable completed set data and does not infer intent from missing logs.
- Exercise-family metadata is taxonomy-derived. Catalog curation can refine it later without changing the engine architecture.
- Subjective program quality requires human UAT before the release gate can be declared complete.
