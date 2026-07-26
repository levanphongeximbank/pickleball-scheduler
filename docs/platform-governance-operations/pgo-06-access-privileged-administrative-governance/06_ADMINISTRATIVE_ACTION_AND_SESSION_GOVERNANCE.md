# 06 — Administrative Action And Session Governance

**Workstream:** PGO-06
**Rule:** Session and attribution policy only. No administrative session is started or altered by this documentation run.

## Control definitions

| Term | Definition | Governance effect |
|---|---|---|
| **Administrative session** | Authenticated period during which administrative or privileged actions may be performed | Must be attributable, time-bounded, and logged |
| **Named identity** | Unique human or approved non-human identity bound to the session | Required for all administrative actions |
| **Shared-account prohibition** | Ban on using shared human credentials for administration | Shared admin logins are non-compliant |
| **Action attribution** | Binding each sensitive action to the acting identity and session | Required for audit and investigation |
| **Sensitive operation** | Administrative action affecting users, roles, tenants, secrets, Production config, or security controls | Requires approval reference when privileged |
| **Approval reference** | Identifier linking the action to an approved request, change, or break-glass record | Required for high-risk administrative actions |
| **Session start / end** | Explicit or system-recorded beginning and termination of the administrative session | Enables duration and revocation evidence |
| **Correlation ID** | Identifier linking related logs, actions, and evidence packages | Aligns with PGO-03 logging and correlation standards |
| **Security audit evidence** | Tamper-evident record of administrative security-relevant events | Required for privileged-operation proof |
| **Failed / denied action** | Attempt that was rejected by policy, authz, or system controls | Must be logged; denial is evidence, not a grant |
| **Post-action verification** | Confirmation that the intended effect occurred and unintended side effects did not | Required for high-risk administrative changes |

## Minimum administrative evidence fields

1. Actor identity and session identifiers.
2. Action type, target identity/resource, and environment/scope.
3. Approval or break-glass reference when applicable.
4. Timestamp, correlation ID, and result (success/denied/failed).
5. Post-action verification notes for high-risk changes.

## Repository evidence (read-only)

| Evidence | Path examples | Interpretation |
|---|---|---|
| Identity audit service | `src/features/identity/services/auditService.js` | Declared audit actions; strips secret metadata by design |
| Audit UI | `src/pages/AuditLogPage.jsx`, `/audit` | Investigation surface; not complete Production attestation |
| Admin update RPC docs | `docs/supabase-identity-v40-phaseC.sql` | Intended privileged update and audit list RPCs |
| PGO-03 security audit catalog | Privileged action / denial event classes | Evidence model; not execution proof |

## Non-claims

1. PGO-06 did not perform administrative actions in any environment.
2. Presence of audit code does not prove Production privileged-operation evidence packages exist.
3. Notification Production Phase 2C remains **`DEFERRED_BY_OWNER`**.
