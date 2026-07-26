# 03 — Access Request, Approval, Provisioning And Removal

**Workstream:** PGO-06
**Rule:** Lifecycle policy only. This document does not execute provisioning, revocation, or offboarding.

## Control definitions

| Term | Definition | Governance effect |
|---|---|---|
| **Access request** | Formal ask for an entitlement with named identity, resource, scope, and duration | No privileged grant without a request record |
| **Business justification** | Stated operational need tied to role/duty | Required for approval; “convenience” is insufficient for privileged access |
| **Resource owner approval** | Access owner confirms continuing business need and scope | Required before provisioning for owned resources |
| **Security review** | Independent review of privileged, platform-wide, or high-risk scope | Required for privileged roles and Production-affecting access |
| **Provisioning evidence** | Record that the approved entitlement was applied as authorized | Must identify actor, time, target, and approval reference |
| **Joiner / mover / leaver** | Lifecycle events for new access, role/scope change, and departure | Each event requires timely grant, modify, or revoke evidence |
| **Access expiry** | Predetermined end of an entitlement | Expired access must be removed or explicitly re-approved |
| **Revocation** | Removal of an entitlement after approval expiry, review decision, or risk event | Revocation SLA remains **`PROVISIONAL_NOT_CERTIFIED`** until Owner approval |
| **Offboarding** | Coordinated leaver process covering app, platform, and external consoles | Incomplete offboarding is an unresolved gap |
| **Emergency removal** | Accelerated revocation to contain risk | Requires justification, named authority, monitoring, and retrospective linkage to PGO-02 when incident-driven |

## Minimum request package

1. Requester identity and target identity/account.
2. Resource, environment, role/permission, and tenant/platform scope.
3. Business justification and requested duration.
4. Resource owner approval and Security review when privileged.
5. Owner GO when Production high-risk criteria apply.
6. Provisioning evidence and correlation/audit identifiers (PGO-03).

## Repository evidence (read-only)

| Area | Path examples | Gap relative to PGO-06 |
|---|---|---|
| User management / role assign | `src/features/identity/services/userManagementService.js` | Operational capability ≠ completed access-request workflow evidence |
| Admin create user | `src/features/identity/services/identityAdminCreateService.js`, related SQL docs | Capability evidence only; no Owner-attested Production roster |
| Club membership join/approve | Club join-request APIs/docs | Domain membership, not platform IAM access request SSOT |
| Signup hardening | `docs/supabase-security-hardening-v357.sql` | Default joiner role intent; not full JML program evidence |
| Suspend/lock patterns | User status model and user-management services | Partial leaver control; offboarding proof absent |

## Honest status

- Formal IAM access-request evidence package for Production: **missing**
- Joiner/mover/leaver execution evidence: **missing**
- Revocation proof and Owner-approved revocation SLA: **missing** / **`PROVISIONAL_NOT_CERTIFIED`**

Notification Production Phase 2C remains **`DEFERRED_BY_OWNER`**.
