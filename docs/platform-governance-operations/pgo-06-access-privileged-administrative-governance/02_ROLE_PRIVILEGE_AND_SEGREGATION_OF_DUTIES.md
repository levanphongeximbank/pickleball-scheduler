# 02 — Role Privilege And Segregation Of Duties

**Workstream:** PGO-06
**Rule:** Policy definitions only. No live role assignment or permission mutation is authorized by this document.

## Control definitions

| Term | Definition | Governance effect |
|---|---|---|
| **Least privilege** | Grant only the minimum authority required for an approved purpose and duration | Excess privilege is a finding; standing excess privilege is not acceptable |
| **Default deny** | Access is denied unless an explicit approved entitlement exists | Absence of a grant is not an implicit allow |
| **Role assignment** | Binding a role to an account within a scope | Requires request, approval, provisioning evidence, and audit attribution |
| **Privileged role** | A role that confers privileged or administrative access | Subject to dual control, review, and elevated logging expectations |
| **Tenant-scoped authority** | Authority limited to one tenant/venue/club (or equivalent) boundary | Cross-tenant action requires explicit platform authority and evidence |
| **Platform-wide authority** | Authority that can affect multiple tenants or platform controls | Restricted to named privileged roles under Owner-approved process |
| **Segregation of duties** | Separation of conflicting responsibilities so one person cannot complete a high-risk chain alone | Required for privileged grants, Production access changes, and break-glass approval |
| **Prohibited self-approval** | Requester approving their own access, elevation, or material privileged change | Forbidden for privileged and Production-affecting cases |
| **Conflicting responsibilities** | Duty pairs that create fraud, concealment, or unchecked risk (for example request+approve, execute+certify alone) | Must be split across independent authorities |
| **Temporary elevation** | Time-bound increase of privilege for an approved purpose | Requires start/end, justification, monitoring, and automatic or immediate revocation |

## Repository evidence (read-only)

| Evidence class | Path examples | Interpretation |
|---|---|---|
| Global vs platform-scoped roles | `src/features/identity/constants/roles.js` (`PLATFORM_ADMIN`, `SYSTEM_TECHNICIAN`, tenant/venue roles) | Declared privileged and scoped role taxonomy |
| Client permission matrix | `src/features/identity/matrix/rolePermissions.js` | Intended role×permission mapping |
| RBAC evaluation | `src/auth/rbac.js`, `src/auth/guardAction.js`, `src/auth/menuAccess.js` | Enforcement design; when RBAC is off, checks are not Production proof of deny |
| Tenant boundary helpers | `src/features/tenant/guards/tenantGuard.js`; RLS docs under `docs/supabase-*.sql` | Intended cross-tenant denial patterns |
| Change SoD precedent | PGO-05 change/emergency approval docs | SoD exists for release change; identity maker-checker is not certified as enforced |

## Segregation rules (policy)

1. Privileged role assignment requires an independent approver distinct from the requester.
2. Resource owners approve business need; Security reviews privileged or platform-wide scope; Owner GO is required for Production high-risk exceptions.
3. Temporary elevation duration remains **`PROVISIONAL_NOT_CERTIFIED`** until Owner approval.
4. Role names in repository source do not certify live Production grants.

## Non-claims

1. PGO-06 did not assign or remove any role.
2. Product RBAC code paths are not treated as completed Production access certification.
3. Notification Production Phase 2C remains **`DEFERRED_BY_OWNER`**.
