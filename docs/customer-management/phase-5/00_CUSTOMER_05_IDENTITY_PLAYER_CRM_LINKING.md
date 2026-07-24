# 00 — CUSTOMER-05 Identity, Player & CRM Linking

**Status:** Implemented in module + authored SQL/RLS (not applied).  
**Branch:** `feature/customer-management-phase-5-identity-player-crm-linking`  
**Depends on:** CUSTOMER-03 → CUSTOMER-04 → CUSTOMER-05

## Purpose

CUSTOMER-05 provides canonical **customer-side linkage** capability between Customer Management and:

1. Identity account (`auth.users.id` / `userAccountId`);
2. Player profile (`playerId`);
3. CRM contact reference (`contactRefId`).

> Customer Management owns the customer-side linkage record, but Identity, Player Management and CRM remain the source of truth for their own entities.

> Matching email, phone or name is not sufficient evidence to create a canonical Customer linkage.

## Ownership boundary

| Concern | Owner |
|---------|--------|
| Linkage record, lifecycle, provenance, uniqueness, reverse lookup, history | **Customer Management** |
| Auth credentials, sessions, OTP, RBAC identity | Identity |
| Player sports profile, ratings, competition identity | Player Management |
| CRM lead/opportunity/campaign/workflow consent | CRM |
| Privacy/retention/deletion/cross-module linking policy | Platform Governance |

Customer stores typed external references only. No credentials. No full Player/CRM object copies.

## Linkage model

### Types

- `IDENTITY_ACCOUNT`
- `PLAYER`
- `CRM_CONTACT`

Organization placeholder on the Customer aggregate is **not** expanded in CUSTOMER-05.

### Status

- `ACTIVE`
- `INACTIVE` (deactivate)
- `UNLINKED` (unlink)

No `PENDING` (no verification workflow in this phase).

### Source

- `MANUAL` | `IMPORT` | `SYSTEM` | `MIGRATION`

### Cardinality & uniqueness (venue scope `{tenantId, venueId}`)

| Type | Per Customer | Per external reference |
|------|--------------|------------------------|
| Identity | ≤ 1 active | ≤ 1 active Customer |
| Player | ≤ 1 active | ≤ 1 active Customer |
| CRM | many active (different contact refs) | ≤ 1 active Customer per `(external_system, contactRefId)` |

Identity account IDs are platform-global UUIDs; uniqueness is still enforced **within Customer venue scope** (a user may theoretically link in another venue only if Owner expands policy later).

### Lifecycle

- Link is idempotent for the same active pair.
- Link rejects cross-customer transfer (`LINKAGE_TRANSFER_REQUIRES_EXPLICIT_ACTION`).
- Unlink/deactivate soft-ends the record (`endedAt`); history is append-only.
- No hard-delete of history. No deletion of Identity/Player/CRM entities.

### No auto-link

Same email, phone, name, booking, club membership, or CRM lead data **never** auto-creates a canonical link. Candidates/conflicts belong to CUSTOMER-06.

## External directory ports (fail-closed)

- `IdentityAccountDirectoryPort` — `getReference` / optional `exists`
- `PlayerDirectoryPort` — `getReference` / optional `exists`
- `CrmContactDirectoryPort` — `getReference` / optional `exists`

If a required directory is missing at write time → `LINKAGE_DIRECTORY_UNAVAILABLE`.  
Existing linkage reads may continue. Raw external IDs are never trusted without directory validation on write.

## Application commands

Identity: `linkIdentityAccount`, `unlinkIdentityAccount`, `getIdentityLink`, `findCustomerByIdentityAccount`  
Player: `linkPlayer`, `unlinkPlayer`, `getPlayerLink`, `findCustomerByPlayerId`  
CRM: `linkCrmReference`, `unlinkCrmReference`, `listCrmReferences`, `findCustomerByCrmReference`  
Shared: `listCustomerLinkages`, `getLinkageHistory`, `validateLinkageConflict`, `deactivateLinkage`

Writes verify Customer existence, scope, directory reference, expectedVersion, uniqueness, append history, bump Customer aggregate version once, and sync denormalized `account_user_id` / `player_id` on `customers` for additive compatibility.

## Persistence

**Method A — single typed table:**

- `customer_linkages`
- `customer_linkage_history`

Trusted RPC: `customer_save_linkage` (service_role only) — transactional history + linkage upsert + customer version/denorm sync.

SQL pack: `docs/customer-management/phase-5/`  
Ordering: CUSTOMER-03 → CUSTOMER-04 → CUSTOMER-05  
Apply status: **authored only** — not Staging, not Production.

## RLS

- RLS + FORCE enabled
- Authenticated SELECT only with `customer_phase3_scope_allows` + `customer.view|edit|super_admin`
- No authenticated writes; no anon; no `USING (true)`
- History append-only trigger

## Runtime

`createCustomerRuntime` injects linkage repository + optional directories.  
Production memory mode rejected. Durable without db/repo fail-closed.

## Staging checklist (Owner-gated)

1. Confirm CUSTOMER-03 + CUSTOMER-04 applied first (or same controlled window).
2. Apply phase-5 SQL in numeric order.
3. Run `99_CUSTOMER_PHASE_5_VERIFICATION.sql`.
4. Smoke link/unlink with service-role path only.
5. Confirm JWT cannot INSERT/UPDATE linkage tables.

## Production blockers

- CUSTOMER-03/04/05 not applied
- Authenticated write policies not Owner-authorized
- Live directory adapters to Identity/Player/CRM not wired for Production
- Legacy venue/booking/club auto-migration not approved

## Legacy adoption backlog

- Do not auto-migrate Identity users, Player profiles, CRM contacts, venue blobs, booking names/phones, or Club members in CUSTOMER-05.

## CUSTOMER-06 entry criteria

See `07_CUSTOMER_06_ENTRY_CRITERIA.md`.
