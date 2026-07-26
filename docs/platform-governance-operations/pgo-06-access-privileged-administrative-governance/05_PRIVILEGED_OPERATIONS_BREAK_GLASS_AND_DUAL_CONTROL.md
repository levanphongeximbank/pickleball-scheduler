# 05 — Privileged Operations, Break-Glass And Dual Control

**Workstream:** PGO-06
**Rule:** Policy and evidence definitions only. This document contains **no** commands that change real access, roles, secrets, or platform authority.

## Control definitions

| Term | Definition | Governance effect |
|---|---|---|
| **Privileged operation** | An action that can alter identity, entitlement, tenancy, secrets, Production configuration, or security controls | Requires approval, attribution, monitoring, and evidence |
| **High-risk administrative action** | Privileged operation with material confidentiality, integrity, availability, or cross-tenant impact | Dual control and Owner GO expectations apply |
| **Dual control** | At least two independent authorities are required to authorize and/or execute | Prevents single-person completion of high-risk chains |
| **Break-glass** | Emergency privileged path used when normal approval cannot safely wait | Narrow scope, time-bound, monitored, retrospectively reviewed |
| **Time-bound elevation** | Temporary privilege increase with explicit start and end | Temporary-elevation duration is **`PROVISIONAL_NOT_CERTIFIED`** |
| **Emergency justification** | Documented reason that normal process cannot wait | Required for break-glass; convenience is invalid |
| **Approval** | Independent authorization distinct from prohibited self-approval | Required before or as soon as incident process permits for Production |
| **Monitoring** | Active observation of the elevated session/actions | Required for the full elevation window |
| **Session evidence** | Named identity, start/end, scope, actions, correlation IDs | Mandatory; links to PGO-03 audit evidence |
| **Immediate revocation** | Ending elevation or access without waiting for normal expiry | Required on completion, timeout, or risk signal; break-glass timeout is **`PROVISIONAL_NOT_CERTIFIED`** |
| **Retrospective** | After-action review of necessity, scope, approvals, and gaps | Mandatory for every break-glass use |
| **PGO-02 incident linkage** | Association of emergency access to an incident record and emergency authority | Required when break-glass is incident-driven |

## Dual-control minimum

1. Requester and independent approver are different people.
2. Executor is named; shared accounts are prohibited.
3. Scope is the narrowest safe set of systems and entitlements.
4. Start/end times and revocation confirmation are recorded.
5. Evidence is retained per Owner-approved retention once certified; until then retention target is **`PROVISIONAL_NOT_CERTIFIED`**.

## Repository evidence (read-only)

| Evidence | Path / note | Interpretation |
|---|---|---|
| Emergency/break-glass change policy | PGO-05 `06_CHANGE_WINDOWS_FREEZES_AND_EMERGENCY_CHANGE.md` | Precedent for emergency authority; not IAM execution evidence |
| Privileged identity RPCs/admin APIs | Identity Phase C SQL docs; admin services | Capability evidence only |
| Product break-glass elevation path | No dedicated time-boxed IAM break-glass implementation found | Gap |
| Cross-tenant “break-glass” mentions in module security docs | Domain-specific notes | Not a certified platform break-glass program |

## Current workstream state

No privileged-operation execution, break-glass exercise, temporary elevation, or access mutation occurred in this documentation-only run.

```text
PRIVILEGED_OPERATION_EXECUTION_EVIDENCE: MISSING
BREAK_GLASS_EXERCISE_EVIDENCE: MISSING
CONTRIBUTES_TO: NOT_READY
```

Notification Production Phase 2C remains **`DEFERRED_BY_OWNER`** and must not be reopened via break-glass.
