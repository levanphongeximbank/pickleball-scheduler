# 05 — Deferred Items, Exceptions, And Non-Certification Boundaries

## Deferred items

| Item | Status | Owner | Notes |
|------|--------|-------|-------|
| Notification Production Phase 2C | **`DEFERRED_BY_OWNER`** | Notification owner + Owner GO | Closed; must not reopen from PGO-01..09 |
| Production operational readiness certification | Deferred until evidence + Owner GO | Owner GO + ops owners | PGO-02 verdict `NOT_READY` |
| Observability readiness certification | Deferred until runtime evidence + Owner GO | Observability owner + Owner GO | PGO-03 `NOT_READY` |
| Environment/secrets readiness certification | Deferred until custody/console evidence | Env/secret authority + Owner GO | PGO-04 `NOT_READY` |
| Release/deploy readiness certification | Deferred until candidate evidence package | Release owner + Owner GO | PGO-05 `NOT_READY` |
| Access/privileged-admin readiness certification | Deferred until inventory/review evidence | Access owner + Owner GO | PGO-06 `NOT_READY` |
| Data protection readiness certification | Deferred until inventory/retention/processor evidence | Data Owner + Owner GO | PGO-07 `NOT_READY` |
| Control assurance readiness certification | Deferred until universe/tests/evidence/review | Assurance owner + Owner GO | PGO-08 `NOT_READY` |

## Owner-deferred decisions

| Decision | Recorded stance |
|----------|-----------------|
| Open Notification Production Phase 2C | Deferred / closed |
| Issue Production GO from PGO documentation alone | Not granted |
| Approve provisional RPO/RTO / SLAs / cadences as certified targets | Not granted — remain provisional |
| Certify legal/regulatory compliance from internal mapping | Not granted |

## Provisional targets

All unapproved numeric or schedule targets across PGO-02..08 (RPO/RTO, retention, access-review cadence, revocation SLA, break-glass timeout, change-window, rollback-time, approval SLA, evidence-retention, test frequency, sampling) remain:

```text
PROVISIONAL_NOT_CERTIFIED
```

They are planning aids only until Owner (and Data Owner where required) approves.

## Unverified controls

Controls described in PGO-02..08 are **documented**. Design and operating effectiveness are **not** Owner-attested across the universe. Status:

```text
CONTROL OPERATION = NOT_VERIFIED
```

## Unverified external platforms

| Platform class (as referenced in PGO docs) | Assurance status |
|--------------------------------------------|------------------|
| Vercel (deploy / project settings) | **`NOT_VERIFIED`** |
| Supabase (project / backup / RLS console) | **`NOT_VERIFIED`** |
| GitHub (branch protection / org policies) | **`NOT_VERIFIED`** |
| Payment providers | **`NOT_VERIFIED`** |
| Notification providers (Production Phase 2C deferred) | **`NOT_VERIFIED`** / track deferred |

External provider mention ≠ external assurance.

## Compliance non-certification

```text
LEGAL/REGULATORY COMPLIANCE = NOT_CERTIFIED
```

PGO-07/PGO-08 may contain mapping frames. Mapping is **not** a compliance certificate, audit opinion, or regulator attestation.

## Risk acceptance

No Owner-approved risk-acceptance record in the PGO series elevates readiness vocabulary. Any future acceptance must name risk, owner, expiry, residual impact, and compensating controls (see doc 06).

## Expiry

- Structural certification remains valid until superseded under post-closure change control (doc 07).
- Provisional targets have **no** certified expiry because they are not certified; they require mandatory review before any Production commitment.
- Deferred Notification Phase 2C has no reopen date implied.

## Reopen condition

| Track | Reopen only if |
|-------|----------------|
| Notification Production Phase 2C | Explicit Owner GO + notification owner plan + evidence path; never implied by PGO-09 |
| Any PGO readiness certification | Gap register items closed + Owner GO for new verdict |
| Structural foundation | Material supersession of PGO docs or discovery of missing core workstream evidence on main |

## Notification Production Phase 2C

```text
NOTIFICATION PHASE 2C = DEFERRED_BY_OWNER
```

PGO-09 must not propose opening, partial enabling, or “temporary” Production notification SQL/apply under this deferred track.

## Non-certification boundaries (hard)

PGO-09 structural / final-integration-with-conditions certification does **not** mean:

1. Production ready
2. Controls operating effectively
3. External assurance complete
4. Legal or regulatory compliance certified
5. All deferred items resolved
6. Unapproved targets certified
