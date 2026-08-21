# VM Training Semantic Media Reconciliation v1.6.1-R5 APPLY

Production project: `inghftngeritrsezwxnm`

Pre-hardening SQL SHA-256: `202544bd066817e8504614bca9c2e84cd4a2b2919df7d63e005bb18148111e8a`

Final SQL SHA-256: `8e1e4c65b30087fa35b769908c63035e83693a58706750dfed1de3ebb939f6d7`

Operational SQL hardening commit: `9ab3134cdb6579740617a681a787fa80472feedf`

## SQL hardening

The approved R5 semantics were preserved. The hardened transaction adds:

- exact `FIRST_RUN` and `ALREADY_RECONCILED` recognition;
- abort on any hybrid or partial state;
- mandatory initial and final `exercise-media` Storage count of zero;
- exact immutable/source metadata validation for the bike GIF;
- `coalesce(candidate_metadata, '{}'::jsonb)` before JSON merge;
- one-to-one audit-event equivalence including media, versions, candidate, decision, action, source status, and target status;
- exact 7 reviewing / 15 rejected / 2 pending postconditions;
- full-row fingerprint preservation for all 17 Production-only candidates;
- locks plus local lock/statement timeouts to prevent an unsafe concurrent reconciliation;
- zero mutation statements for an idempotent state-B rerun.

Static DML inspection found:

| Target | Statement envelope |
| --- | ---: |
| `exercise_media` INSERT | 1 statement, at most 1 row |
| `exercise_media` UPDATE | 1 statement, exactly 24 payload rows on first run |
| `media_review_events` INSERT | 1 statement, exactly 24 payload rows on first run |
| DELETE | 0 |
| `exercises` UPDATE | 0 |
| Storage mutation | 0 |
| Migration/schema/ACL/Auth mutation | 0 |

## Local validation

The audited 40-row Production identity baseline was reproduced inside a local transaction. Existing local Storage metadata was moved to a temporary local-only bucket inside the transaction so the Production zero-object precondition could be exercised; every test ended in rollback and the temporary bucket did not persist.

First run result:

```json
{"input_state":"FIRST_RUN","candidate_delta":1,"target_rows_updated":24,"event_delta":24,"candidates":41,"reviewing":7,"rejected":15,"pending_validation_targets":2,"r5_events":24,"production_only_preserved":17,"storage":0}
```

Second run in the same transaction:

```json
{"input_state":"ALREADY_RECONCILED","candidate_delta":0,"target_rows_updated":0,"event_delta":0,"candidates":41,"reviewing":7,"rejected":15,"pending_validation_targets":2,"r5_events":24,"production_only_preserved":17,"storage":0}
```

Expected-abort tests:

| Hybrid state | Result |
| --- | --- |
| Bike exists with only 10 R5 events | PASS — aborted |
| Candidate count 41 with wrong target status | PASS — aborted |
| Storage count greater than zero | PASS — aborted |
| Bike licensing metadata changed | PASS — aborted |

Local rollback verification restored 40 media rows, 47 prior local audit events, 7 prior local active exercises, and 14 prior local Storage objects. Temporary bucket count was zero.

## Production preflight

Immediately before apply, a SELECT-only preflight returned the exact `FIRST_RUN` state:

| Check | Expected | Actual |
| --- | ---: | ---: |
| Candidates | 40 | 40 |
| Validated bike GIF | 0 | 0 |
| Existing validation targets | 23 | 23 |
| Existing targets pending | 23 | 23 |
| Existing targets with safe flags | 23 | 23 |
| R5 events | 0 | 0 |
| Approved | 0 | 0 |
| `is_primary` | 0 | 0 |
| `PRIMARY_DEMO` | 0 | 0 |
| Active exercises | 0 | 0 |
| Storage objects | 0 | 0 |
| Audited baseline identities | 40 | 40 |
| Validated PRIMARY sources present | 6 | 6 |
| Production-only candidates | 17 | 17 |
| Duplicate identities | 0 | 0 |
| Migration history | 18 | 18 |

The 18 remote migration versions matched all 18 local migration versions exactly.

Production-only fingerprint before apply: `d0cd9eac718cf72e3b3b4dc3888f05fb`

## Apply

Transaction: **COMMITTED**

| Mutation | Result |
| --- | ---: |
| Bike GIF candidate inserted | YES — 1 |
| Validation target rows updated | 24 |
| Audit events inserted | 24 |
| Deletes | 0 |
| Storage writes | 0 |

The operational query returned:

```json
{"input_state":"FIRST_RUN","candidate_delta":1,"target_rows_updated":24,"event_delta":24,"candidates":41,"reviewing":7,"rejected":15,"pending_validation_targets":2,"r5_events":24,"production_only_preserved":17,"storage":0}
```

No manual row repair or secondary Production mutation was performed.

## Final state

| Check | Expected | Actual |
| --- | ---: | ---: |
| Candidates | 41 | 41 |
| Validation targets | 24 | 24 |
| Reviewing / APPROVE recommendation | 7 | 7 |
| Rejected / REJECT | 15 | 15 |
| Pending / KEEP_PENDING | 2 | 2 |
| Exact validation metadata | 24 | 24 |
| R5 audit events | 24 | 24 |
| Valid one-to-one R5 events | 24 | 24 |
| Event cardinality violations | 0 | 0 |
| Validated PRIMARY sources | 7 | 7 |
| Approved | 0 | 0 |
| `is_primary` | 0 | 0 |
| `PRIMARY_DEMO` | 0 | 0 |
| Active exercises | 0 | 0 |
| Storage objects | 0 | 0 |
| Production-only candidates preserved | 17 | 17 |
| Duplicate identities | 0 | 0 |

The bike candidate's exercise, source URL, media/source types, license code and URL, author, attribution requirement, and original file URL all match the approved R5 payload.

Production-only fingerprint after apply: `d0cd9eac718cf72e3b3b4dc3888f05fb`

Expected mutations among those 17 records: 0. Actual: 0.

## Idempotency

The SELECT-only postflight satisfies every `ALREADY_RECONCILED` precondition used by the operational SQL:

- State B recognized: **YES**;
- candidate delta if invoked again: **0**;
- target update rows if invoked again: **0**;
- event delta if invoked again: **0**.

The operational SQL was not executed a second time in Production.

## Structural safety

| Check | Result |
| --- | --- |
| Migration history | PASS — 18/18 exact versions |
| ACL | PASS — 81 entries, diff 0 |
| RLS | PASS — no public table without RLS; pgTAP 62/62 |
| Security Advisor | PASS — 0 findings |
| Lint | PASS |
| Typecheck | PASS |
| Unit | PASS — 45/45 |
| GIF-first manifest integrity | PASS — 7/7 GIF and poster hashes |
| Build | PASS |

The R5 SQL contains no schema, migration, grant, policy, RLS, ACL, Auth, or Storage mutation.

## Git

- hardened SQL commit: `9ab3134cdb6579740617a681a787fa80472feedf`;
- apply report: versioned on `main` after postflight verification;
- push target: `origin/main`;
- secret findings in committed R5 artifacts: 0;
- media binaries and environment files committed: 0.

## Gate

`READY_FOR_PRIMARY_MEDIA_PRODUCTION_PROMOTION`

STOP. This reconciliation did not upload or publish any GIF and did not activate any exercise.
