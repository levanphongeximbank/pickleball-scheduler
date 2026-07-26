# 01 — Access Taxonomy, Ownership And Authority

**Workstream:** PGO-06
**Fresh baseline:** `0c55f0814aeae1c470c65204b72e6dba0aad9f80`
**Rule:** Taxonomy definitions govern evidence expectations. They do not grant, revoke, or prove live Production entitlements.

## Control definitions

| Term | Definition | Governance effect |
|---|---|---|
| **Identity** | A uniquely attributable subject (human or non-human) recognized by authentication and audit systems | Every access decision and privileged action must map to an identity |
| **Account** | A credentialed representation of an identity in one or more systems | Accounts require an owner, purpose, and lifecycle state |
| **Role** | A named bundle of authorities assigned to an account within a defined scope | Role assignment is an entitlement event requiring approval evidence |
| **Permission** | An atomic allowed operation (for example create, read, update, manage) | Permissions are evaluated under least privilege and default deny |
| **Entitlement** | The approved combination of identity, account, role/permission, resource, and scope | Entitlements are inventoryable and reviewable |
| **Privileged access** | Access that can change security posture, identity state, data integrity, tenancy, secrets, or Production configuration | Requires elevated approval, logging, and review |
| **Administrative access** | Access used to administer users, roles, tenants, platforms, or operational controls | Must use named identity and attributable sessions |
| **Service account** | A non-human account used by automation or backend workloads | Requires owner, purpose, least privilege, and credential custody |
| **Machine identity** | A workload, pipeline, or platform identity used for non-interactive authentication | Same custody and review obligations as service accounts |
| **Access owner** | Person accountable for a resource’s entitlements and continuing business need | Approves or rejects access affecting that resource |
| **Approver** | Independent authority that may approve an access or privileged-operation request | Must not be the same person as prohibited self-approval cases |
| **Reviewer** | Authority performing periodic access review or recertification | Must have documented reviewer authority for the population |
| **Owner GO** | Explicit Owner go-ahead for a bounded Production or high-risk action | Required for Production access-affecting certification and high-risk exceptions |

## Repository evidence (read-only; not live grant proof)

| Evidence class | Repository path examples | What it proves | What it does not prove |
|---|---|---|---|
| Identity module architecture | `src/features/identity/ARCHITECTURE.md` | Intended identity phases and surfaces | Production roster or live grants |
| Role and permission catalogs | `src/features/identity/constants/roles.js`, `permissions.js`, `matrix/rolePermissions.js` | Declared role/permission model | That roles are assigned in Production |
| RBAC feature flag contract | `src/auth/config.js`, PGO-04 authority docs referencing `VITE_RBAC_ENABLED` | Flag-controlled enforcement design | Live Production RBAC enablement attestation |
| Profile / account model | `src/models/user.js`, auth/profile services | Account status and linkage concepts | Owner-attested account inventory |
| Identity SQL/RPC docs | `docs/supabase-identity-v40-*.sql`, `docs/supabase-rbac.sql` | Intended server controls and admin RPCs | Applied Production schema or credential use |

## Authority boundary

- PGO-01 defines organizational ownership and registry baselines.
- PGO-06 defines access taxonomy and privileged-admin evidence rules.
- Module owners propose entitlements for owned resources; Security reviews privileged scope; Owner GO is required for Production certification and high-risk exceptions.
- Presence of a role string in source is **not** proof of Production access.

## Non-claims

1. PGO-06 did not create, modify, or delete accounts.
2. PGO-06 did not change roles, permissions, or entitlements.
3. PGO-06 did not read `.env` values or service-role credentials.
4. Notification Production Phase 2C remains **`DEFERRED_BY_OWNER`**.
