# 06 — Configuration Drift, Change And Approval

**Workstream:** PGO-04
**Fresh `origin/main`:** `ec3c534d93eb36e3514791ea6550228c3bc75ea3`
**Snapshot timestamp:** `2026-07-25T23:47:21+07:00`
**Baselines:** PGO-01 (authority / deferred); PGO-02 (rollback / incident).
**Rule:** Drift without evidence is a governance gap, not an automatic Production outage.

## What is configuration drift?

**Drift** = divergence between:

1. **Declared** configuration (tracked templates, docs checklists, expected names), and
2. **Effective** configuration (CI secrets/vars, Vercel/Netlify/Supabase console values, runtime behavior),

across environments (especially Staging vs Production) or over time.

Examples of drift **signals** (names/paths only):

| Signal | Evidence type | Not sufficient alone |
|--------|---------------|----------------------|
| Template name set ≠ CI secret/var name set | Repo comparison | Console values |
| GA checklist required names missing from workflow refs | Docs vs `.github/workflows/deploy.yml` | Live Vercel console |
| Staging script expects `STAGING_*` while Production uses `VITE_*` / `PRODUCTION_*` | Script inventory | Proof of wrong live binding |
| Feature flag default OFF in docs but ON in an environment | Docs vs attested env | Assumed without attestation |

## Comparison evidence (required for certification)

| Comparison | Owner | Evidence artifact |
|------------|-------|-------------------|
| Template inventory vs CI referenced names | Platform ops | Diff of **names** only |
| Staging vs Production required name sets | Env owners | Checklist with Owner attestation |
| Client-safe vs server-only classification audit | Security + Platform | Classification table ([02](./02_CONFIGURATION_CLASSIFICATION_AND_OWNERSHIP.md), [04](./04_CLIENT_SERVER_BOUNDARY_AND_EXPOSURE_RULES.md)) |
| External console vs repo declaration | Platform ops + Owner | Screenshot/attestation metadata — **values redacted** |

PGO-04 snapshot: **no** Owner-attested Staging↔Production console comparison attached → drift controls = **GAP** for certification.

## Change request model

| Field | Requirement |
|-------|-------------|
| Change ID | Unique |
| Environment(s) | Local / Dev / Test / Staging / Production |
| Config class | Client-safe / server-only / secret / flag / external |
| Names affected | Variable **names** only |
| Reason | Why |
| Risk | Incl. exposure / outage / authz |
| Rollback plan | How to revert |
| Owner GO | Required for Staging remote / Production / secrets |
| Evidence plan | How success/failure is proven without printing secrets |

## Review and Owner GO

| Change class | Reviewers | Owner GO |
|--------------|-----------|----------|
| Docs under PGO-04 path | Owner review for merge | Granted for docs-only implementation |
| Template / workflow name additions | Module + Platform + Security (if secret-shaped) | Yes for shared CI/secret names |
| Staging console / remote apply | Staging env owner | **Yes** |
| Production env / secret rotate | Platform ops + Security | **Yes** |
| Reopen Notification Phase 2C | Notification owner | **Blocked** — `DEFERRED_BY_OWNER` |

## Rollback plan (minimum)

1. Identify previous known-good configuration **names/scopes** (not values in tickets if avoidable).
2. Revert deploy or restore previous env scope via platform authority (Vercel/GitHub/Supabase) under Owner GO.
3. Verify with fail-closed preflight / smoke that does not log secrets.
4. File PGO-02 incident if SEV warrants.
5. Record audit trail (who/when/what names/environments).

## Emergency change

| Condition | Control |
|-----------|---------|
| Active Production incident needing env/secret change | PGO-02 SEV process + Owner GO (or documented emergency delegate) |
| Suspected secret leak | Revoke/rotate under [03](./03_SECRET_CLASSIFICATION_LIFECYCLE_AND_ACCESS.md); incident evidence; **no** value in chat/docs |
| Mis-set public flag causing outage | Kill switch / flag OFF per [07](./07_FEATURE_FLAG_AND_KILL_SWITCH_GOVERNANCE.md) with audit |

Emergency does **not** waive audit trail or post-change review.

## Audit trail requirements

Retain (metadata only):

- Change ID, requester, approver, Owner GO reference
- Environment + variable **names**
- Timestamp start/end
- Result (success/fail) and verification command names
- Link to incident/postmortem if any

Do **not** retain secret values in tickets, PGO docs, or chat logs.

## Snapshot honesty

```text
DRIFT_CONTROLS: GAP / MODEL_ONLY
EXTERNAL_COMPARISON_EVIDENCE: NOT_ATTACHED
ROTATION_SCHEDULE: PROVISIONAL_NOT_CERTIFIED
```
