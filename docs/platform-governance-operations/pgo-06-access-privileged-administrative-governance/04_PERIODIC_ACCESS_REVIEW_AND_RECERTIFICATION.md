# 04 — Periodic Access Review And Recertification

**Workstream:** PGO-06
**Rule:** Review model only. Completing a live recertification is out of scope for this documentation run.

## Control definitions

| Term | Definition | Governance effect |
|---|---|---|
| **Access inventory** | Authoritative list of identities, accounts, roles, entitlements, and scopes in scope for review | Reviews cannot certify without an inventory |
| **Review population** | The bounded set of accounts/entitlements under a specific review | Must be explicit (for example privileged roles, Production console access) |
| **Reviewer authority** | Documented right to recertify, modify, or revoke within the population | Reviewers must be independent of prohibited self-certification cases |
| **Recertify** | Confirm continuing business need and correct scope | Creates positive evidence for the next review cycle |
| **Modify** | Reduce, re-scope, or change entitlement during review | Requires provisioning/revocation evidence |
| **Revoke** | Remove entitlement that is no longer justified or is risky | Required outcome for unjustified or stale access |
| **Stale access** | Entitlement without continuing need or beyond approved duration | Must be modified or revoked |
| **Orphaned account** | Account without a valid owner or linked identity | Must be investigated and typically revoked |
| **Inactive account** | Account with no required activity per Owner-approved criteria | Must be reviewed for disablement/revocation |
| **Unresolved exception** | Accepted deviation with owner, rationale, and expiry | Exceptions without expiry block certification |
| **Evidence package** | Dated inventory, decisions, approvers, exceptions, and remediation proof | Required for readiness beyond `NOT_READY` |

## Cadence and targets

Access-review cadence is **`PROVISIONAL_NOT_CERTIFIED`** until Owner approval. Access-evidence retention target is **`PROVISIONAL_NOT_CERTIFIED`** and must align with PGO-03 retention/redaction policy once Owner-approved.

## Repository evidence (read-only)

| Evidence | Path / note | Status |
|---|---|---|
| Expected audit event class for access certification | PGO-03 security audit logging catalog | Policy aspiration; not completed review evidence |
| Identity audit UI/RPC | `/audit`, `identity_list_audit_logs` docs/services | Can support investigation; does not equal recertification |
| Product periodic access-review workflow | Not found as platform IAM SSOT | Gap |

## Honest status

No Owner-attested Production access roster, completed periodic access review, or recertification evidence package exists for this workstream snapshot. Contributes to:

```text
VERDICT: NOT_READY
```

Notification Production Phase 2C remains **`DEFERRED_BY_OWNER`**.
