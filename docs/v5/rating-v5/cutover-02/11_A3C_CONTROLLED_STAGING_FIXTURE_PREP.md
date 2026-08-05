# RATING-V5-CUTOVER-02 — Gate A3c Controlled Staging Fixture Preparation

```text
STAGING_MUTATION_GO=NO
STAGING_DEPLOYMENT_GO=NO
S0_EXECUTION_GO=NO
SQL_GUARD_APPLY_GO=NO
PRODUCTION_GO=NO
SQL_EXECUTION=0
EDGE_DEPLOYMENTS=0
NO_STAGING_MUTATION_IN_THIS_GATE=YES
```

## 1. Architecture decision

**Selected:** `A_EDGE_ORCHESTRATION_PLUS_SERVICE_ROLE_RPC`

Trusted Staging SUPER_ADMIN (or `rating_v5.calibration_manage`) calls Edge shell → validation → service_role RPCs only after guards. Canonical V5 scoring runs in trusted Node/Edge orchestrator (`scoreAssessment` / `scoreAssessmentForPersistence`). Enrollment + V2 sync use existing admin/sync paths under the caller JWT. Draft V5 assessment uses Staging-only service RPC so **candidate JWT is not required**.

### Why safer than alternatives

| Option | Why not preferred |
|--------|-------------------|
| B — Extend `rating-v5-complete-assessment` | Widens a Production-deployed path; risk of accidental Production enablement |
| C — Browser-callable security-definer RPC | Harder to prove no authenticated EXECUTE leak; puts mutation closer to clients |
| Candidate-session path | **Rejected** — requires candidate password/JWT/magic-link (prohibited) |

## 2. Threat model

| Threat | Mitigation |
|--------|------------|
| Anon / ordinary user invokes prep | Caller guard + Edge JWT + SQL caller re-check |
| Fixture player self-invokes | Same caller guard (must be SUPER_ADMIN / calibration) |
| Production apply / run | Project deny `expuvcohlcjzvrrauvud` in SQL + JS |
| Arbitrary player / cohort / rating | Fixed allowlist + exact cohort + approved answer recipes |
| Silent score override | `SCORE_OUTPUT_MISMATCH` — never falsify scorer output |
| Service-role in browser | Never exported; client helper rejects credential fields |
| Direct table writes from client | Prohibited; only trusted RPC/Edge |
| Partial repair | `PARTIAL_STATE_BLOCKED` — no silent repair |

## 3. Exact guards

| Guard | Rule |
|-------|------|
| Project | Allow only `qyewbxjsiiyufanzcjcq`; deny `expuvcohlcjzvrrauvud`; missing ref denied |
| Caller | Authenticated; `is_super_admin` / SUPER_ADMIN **or** `rating_v5.calibration_manage`; auditable caller id; no anonymous service-role-only |
| Target | auth+profile, active, `profiles.id = auth user`, Wave1 `@staging.local` evidence, exact five hashes |
| Cohort | Exact `rating-v5-cutover-02-staging-rehearsal-wave-a` |
| Value | Only approved raw V2 + recipe-derived V5 display per candidate |

## 4. Fixture manifest (redacted)

Cohort: `rating-v5-cutover-02-staging-rehearsal-wave-a`  
`MAPPING_STATUS=UNAPPROVED` · `NORMALIZED_EQUIVALENCE=DISABLED`

| Label | id_hash | V2 raw | V5 target display | Answer recipe |
|-------|---------|--------|-------------------|---------------|
| CANDIDATE-01 | e97fa28f4a36 | 2.0 | 2.2 | default 1, groundstroke→6 |
| CANDIDATE-02 | 0b464be6cbba | 3.0 | 2.8 | default 2, groundstroke→7 |
| CANDIDATE-03 | 9154af71ee16 | 3.5 | 3.1 | default 3, consistency→0 |
| CANDIDATE-04 | d678d828c636 | 4.0 | 3.6 | default 4, groundstroke→0 |
| CANDIDATE-05 | 3d644a31b486 | 5.0 | 4.2 | default 5, groundstroke→1 |

No email / name / phone / raw UUID in this document. phase4-owner-acceptance pilot **untouched**.

## 5. Canonical V5 invariants

Per prepared candidate:

- one active enrollment for the exact new cohort
- one canonical V2 baseline row (via `pick_vn_sync_rating`)
- one V5 assessment with ownership = target player
- draft→completed via canonical persist payload
- `is_shadow=true`
- one V5 shadow profile + event evidence
- published authority remains **V2**
- no V5 promotion / no rollout-config change

## 6. Mutation-count model

See `buildCohortWriteModel()` in code.

| Ceiling | Value |
|---------|------:|
| AUTH_USER_CREATIONS | 0 |
| PROFILE_CREATIONS | 0 |
| ROLLOUT_CONFIG_CHANGES | 0 |
| CURRENT_PHASE4_PILOT_CHANGES | 0 |
| ENROLLMENT_ROWS_MAX | 5 |
| V2_PRIMARY_ROWS_MAX | 5 |
| V5_PROFILE_ROWS_MAX | 5 |
| V5_ASSESSMENT_EVENT_EVIDENCE_ROWS_MAX | 25 |
| TOTAL_DURABLE_WRITE_CEILING | 40 |

Predicted first-run durable writes: **min 25 / max 30**; with one idempotent retry audit each: **max 35**.  
`MUTATION_BUDGET_REQUIRES_OWNER_REVISION=NO`

This is **not** execution approval.

## 7. Idempotency / collision state machine

Outcomes: `PREPARED` · `ALREADY_PREPARED` · `PARTIAL_STATE_BLOCKED` · `COLLISION_BLOCKED` · `TARGET_NOT_APPROVED` · `WRONG_PROJECT` · `UNAUTHORIZED_CALLER` · `SCORE_OUTPUT_MISMATCH` · `MUTATION_BUDGET_EXCEEDED` · `INTERNAL_ERROR_ROLLED_BACK`

Key: `project|cohort|id_hash|preparation_version` (`a3c-v1`).

## 8. Rollback runbook

`ROLLBACK_TARGETS_EXACT_FIVE_CANDIDATES=YES`

- Scope: Staging ref + exact cohort + exact five hashes + prep version `a3c-v1`
- Enrollment: deactivate/remove **only** new cohort rows; preserve phase4 + other enrollments
- V2: restore snapshot; if prior count was 0, remove only rehearsal-created row — never blanket-delete
- V5: invalidate/quarantine fixture prep assessments/profiles; preserve immutable events; mark prep rolled back
- Rollout: confirm unchanged
- Freeze: OFF; SQL writer-freeze guard remains **unapplied** during A3 prep

## 9. Deployment / apply checklist (future Owner GO only)

1. Confirm Staging project `qyewbxjsiiyufanzcjcq`
2. Apply author-only SQL (separate GO)
3. Deploy Edge function (separate GO)
4. Enable `VITE_RATING_V5_CUTOVER_02_FIXTURE_PREP_ENABLED` only on Staging operator surface
5. Invoke per candidate; collect redacted evidence
6. Do **not** start S0 until Owner GO

## 10. Owner GO gate

This gate authorizes **local** implementation only.  
Still **NO**: SQL apply, Edge deploy, Staging mutation, S0–S3, Production, published authority flip.

## 11. Evidence template (redacted)

```json
{
  "kind": "cutover_02_a3c_fixture_prep",
  "candidateLabel": "CANDIDATE-0N",
  "candidateIdHash": "<12 hex>",
  "cohortLabel": "rating-v5-cutover-02-staging-rehearsal-wave-a",
  "preparationVersion": "a3c-v1",
  "projectRef": "qyewbxjsiiyufanzcjcq",
  "outcome": "PREPARED|ALREADY_PREPARED|...",
  "v2Raw": 0,
  "v5ScorerOutput": 0,
  "mappingStatus": "UNAPPROVED",
  "normalizedEquivalence": "DISABLED",
  "callerIdHash": "<evidence hash>",
  "rollbackHandle": "rb:qyewbxjsiiyufanzcjcq:..."
}
```

Forbidden in evidence: email, name, phone, JWT, password, service-role key, unnecessary raw UUID in user docs.

## 12. Explicit statement

**No Staging mutation has occurred in Gate A3c.**  
Author-only SQL and Edge scaffold are not applied/deployed.

## Code paths

| Area | Path |
|------|------|
| Orchestrator | `src/features/player-rating/cutover-02/fixture-prep/` |
| SQL (author only) | `docs/v5/rating-v5/cutover-02/sql/RATING_V5_CUTOVER_02_A3C_FIXTURE_PREP.sql` |
| Edge (author only) | `supabase/functions/rating-v5-cutover-02-prepare-fixture/` |
| Tests | `tests/rating-v5-cutover-02-a3c-fixture-prep.test.js` |
