# 10 — Staging QA Identity Matrix

**Phase:** CRM Phase 1H-B
**Staging project ref:** `qyewbxjsiiyufanzcjcq`
**Production ref (blocked):** `expuvcohlcjzvrrauvud`
**Secrets in this doc:** none (aliases only)

## Owner decisions

| Decision | Status |
|----------|--------|
| Reuse Staging QA identities | **APPROVED** |
| Create users / reset passwords | **NOT APPROVED** |
| Apply role matrix order 8 | **DEFERRED** |
| STAFF identity | **WAIVED** |
| CUSTOMER identity | **WAIVED** |
| `QA_ADMIN` bypass | **UNAVAILABLE** this wave |

## Boolean readiness (final)

```
STAGING_ANON_KEY_SET=true
QA_OPERATOR_A_SET=true
QA_OPERATOR_B_SET=true
QA_UNAUTHORIZED_SET=true
QA_CROSS_TENANT_SET=true
QA_CROSS_VENUE_SET=true
QA_ADMIN_SET=false
CRM_STAGING_QA_IDENTITIES_READY=true
```

## Alias inventory (sanitized)

| Alias | Venue | Role class | Coverage class |
|-------|-------|------------|----------------|
| `QA_OPERATOR_A` | VENUE_A | OWNER_CLASS | Used — positive path **PARTIAL** |
| `QA_OPERATOR_B` | VENUE_A | OWNER_CLASS | Used — concurrency identity **PASS** |
| `QA_UNAUTHORIZED` | VENUE_A | PLAYER_CLASS | Used — deny **PASS** |
| `QA_CROSS_TENANT` | VENUE_B | OWNER_CLASS | Used — isolation **PASS** |
| `QA_CROSS_VENUE` | VENUE_B | OWNER_CLASS | Used — isolation **PASS** |
| `QA_ADMIN` | — | — | **UNAVAILABLE** |
| STAFF | — | — | **WAIVED** |
| CUSTOMER | — | — | **WAIVED** |

## Final marks

| Item | Class |
|------|-------|
| non-admin permission-positive | **PARTIAL** |
| claim/release positive path | **BLOCKED** |
| role-matrix rows | **0** (**PASS** / expected under **DEFERRED** matrix) |
| durable runtime | **OFF** |
| Production / deploy / workers | no |
| secrets printed | no |

Live evidence: `08_IDENTITY_BOUND_LIVE_QA.md`
Certification: `12_PHASE_1H_B_FINAL_CERTIFICATION.md`
