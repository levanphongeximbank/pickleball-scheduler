# Club Phase 2 — Acceptance Gates

**Status:** FROZEN / **LOCKED** (documentation only)  
**Date:** 2026-07-19  
**Authority:** Phase 2B Domain & API Freeze  
**Phase status:** 2A CLOSED · 2B LOCKED · Next: **2C** (not started)  
**Use:** Explicit GO / NO-GO before exiting each phase  
**Cardinality:** Captain 0..N + optional primary · Coach 0..N · Committee excluded

---

## 1. How to use

- Every phase ends with a **gate review**.  
- **NO-GO** blocks the next phase (except pure design spikes marked parallel).  
- Production apply (SQL/flags) additionally requires **Owner GO**.  
- Evidence: markdown/json reports under `docs/club-phase2/` or `docs/v5/qa-evidence/` as appropriate.

| Result | Meaning |
|--------|---------|
| **GO** | All mandatory checks pass |
| **NO-GO** | Any mandatory check fails |
| **WAIVE** | Owner-signed exception with expiry + risk note |

---

## 2. Cross-cutting gate catalog

Use these IDs inside each phase checklist.

| ID | Gate | Pass criteria |
|----|------|---------------|
| G-ARCH | Architecture | Matches domain freeze + dependency allow-list; no new SoT leaks |
| G-API | API compatibility | Freeze APIs only; deprecated paths gated; peer imports allow-listed |
| G-AUTHZ | Authorization | Server RPC checks match role matrix; client not sole control |
| G-RLS | RLS | Business tables: select policies only; no authenticated direct writes |
| G-TENANT | Multi-tenant isolation | Cross-tenant read/write attempts denied in tests |
| G-VER | Expected-version | Stale `expected_version` → `VERSION_CONFLICT`; no silent overwrite |
| G-IDEM | Idempotency | Replay same key+payload safe; conflicting payload → conflict error |
| G-AUDIT | Audit coverage | Each mutating API emits named audit event |
| G-RB | Rollback readiness | Documented rollback (SQL down / flag off / feature disable) |
| G-FLAG | Flag on/off | V2 ON = canonical; V2 OFF = no Production claim; no dual-write features |
| G-STG | Staging QA | Staging apply (if SQL) + scripted/manual QA pass |
| G-PRE | Production preflight | Readonly preflight report green |
| G-SMOKE | Production smoke | Post-apply smoke scenarios pass |

---

## 3. Phase 2B gates (Domain & API freeze)

| Gate | Mandatory | Criteria |
|------|-----------|----------|
| G-ARCH | Yes | Freeze docs exist; Committee **excluded**; Invite/Captain/Coach GO; Captain 0..N + optional primary; Coach 0..N |
| Product decisions | Yes | Owner decisions + deferred 2E/2F topics recorded |
| No runtime change | Yes | No code/SQL/deploy/push/PR for 2B itself |
| Sequence lock | Yes | 2B→2H sequence published; next = **2C** |
| Phase 2B LOCKED | Yes | Domain/API/writer/allow-list/gates freeze docs present |

**2B exit:** **GO** when this pack is accepted.

---

## 4. Phase 2C gates (Membership & roster parity)

| Gate | Mandatory | Criteria |
|------|-----------|----------|
| G-ARCH | Yes | Membership single writer path documented + implemented under V2 ON |
| G-API | Yes | membership.* + joinRequest.* behave per freeze |
| G-AUTHZ | Yes | VP cannot remove members; review rights match matrix |
| G-RLS | Yes | No new direct table writes |
| G-TENANT | Yes | Cross-tenant membership denied |
| G-VER / G-IDEM | Yes | On membership mutating RPCs |
| G-AUDIT | Yes | membership.* + join_request.* events |
| G-FLAG | Yes | Phase 31 client dead on V2 ON |
| G-RB | Yes | Flag-off / prior RPC note |
| Roster design | Yes | `club_roster_assignments` design approved (ship optional) |
| G-STG | Yes if SQL changed | Else unit/integration evidence |

**NO-GO if:** extension still authoritative under V2 ON; dual-write of new membership features.

---

## 5. Phase 2D gates (Governance certification)

| Gate | Mandatory | Criteria |
|------|-----------|----------|
| G-ARCH | Yes | Assignments SoT = `club_governance_assignments` only under V2 ON |
| G-AUTHZ | Yes | Phase 1B/1C gates preserved (`can_update`, VP, `can_assign_owner`) |
| G-VER / G-IDEM / G-AUDIT | Yes | All governance.* commands |
| G-TENANT | Yes | |
| G-FLAG | Yes | Local governance JSON not Production writer |
| G-STG | Yes if SQL | |
| Regression pack | Yes | Owner assign / VP / update club smoke |

**NO-GO if:** tenant_staff can assign owner; local meta write bypasses RPC.

---

## 6. Phase 2E gates (Invitation + Captain/Coach)

| Gate | Mandatory | Criteria |
|------|-----------|----------|
| G-ARCH | Yes | Tables match domain freeze; Committee still absent |
| G-API | Yes | invitation.* + roster.* implemented |
| G-AUTHZ | Yes | Actor policies per API freeze |
| G-RLS | Yes | New tables RLS select-only; RPC writes |
| G-TENANT | Yes | |
| G-VER / G-IDEM / G-AUDIT | Yes | |
| G-RB | Yes | Rollback SQL + feature flag |
| G-FLAG | Yes | No local-extension SoT for invite/roster |
| Accept→membership | Yes | Accept/approve create active membership once |
| Leave clears roster | Yes | Captain/Coach cleared on leave/remove |
| Cardinality | Yes | Multiple captains/coaches allowed; optional primary captain; no single-* rejection |
| G-STG | Yes | |
| G-PRE / G-SMOKE | Yes for Production | Owner GO |

**NO-GO if:** invite accept bypasses membership authz; captain assign without active member.

---

## 7. Phase 2F gates (Boundary cutovers)

| Gate | Mandatory | Criteria |
|------|-----------|----------|
| G-ARCH | Yes | Import allow-list honored for touched modules |
| G-API | Yes | Competition uses roster read ports; no membership writes |
| Player repo home | Yes | Canonical player repository not under Club |
| Rating decision | Yes | Recorded Owner/product decision; dual-write stopped or labeled |
| Blob plan | Yes | Venue/Competition extraction plan published |
| G-STG | As needed | |

**NO-GO if:** new peer blob SoT introduced; Competition writes `club_members`.

---

## 8. Phase 2G gates (Legacy retirement)

| Gate | Mandatory | Criteria |
|------|-----------|----------|
| G-FLAG | Yes | Production default V2 ON |
| Legacy writers | Yes | Registry upsert / extension members / local roles gated or removed |
| Peer blob | Yes | Allow-list forbids direct Club blob reads for retired concerns |
| G-API | Yes | Deprecated APIs removed or hard-error |
| G-RB | Yes | Emergency V2-OFF procedure documented (support only) |

**NO-GO if:** any Production path dual-writes Club SoT.

---

## 9. Phase 2H gates (Final Production certification)

| Gate | Mandatory | Criteria |
|------|-----------|----------|
| All G-* catalog | Yes | Evidence attached |
| G-PRE | Yes | Readonly preflight |
| G-SMOKE | Yes | Create club, join request, invite, captain/coach, governance, leave |
| Security | Yes | 1B/1C posture intact |
| Docs | Yes | Freeze + cert reports linked |
| Owner GO | Yes | Signed Production release |

**2H GO ⇒ Phase 2 CLOSED for Production.**

---

## 10. Minimum smoke matrix (2E / 2H)

| # | Scenario | Expect |
|---|----------|--------|
| S1 | Create/update club | version bumps; audit |
| S2 | Join request approve | membership active |
| S3 | Invitation accept | membership active; invite accepted |
| S4 | Invitation expire/revoke | accept fails |
| S5 | Assign multiple captains/coaches; set primary captain | lists reflect; primary optional; clear primary keeps captains |
| S6 | Assign owner (tenant_owner/SA only) | staff forbidden |
| S7 | VP cannot remove member | FORBIDDEN |
| S8 | Cross-tenant club id | TENANT_MISMATCH / NOT_FOUND |
| S9 | Stale expected_version | VERSION_CONFLICT |
| S10 | Idempotent replay | same result |

---

## 11. Gate sign-off template

```text
Phase: __
Date: __
Reviewer: __
Owner GO required: yes/no
Result: GO | NO-GO | WAIVE
Evidence links:
Notes:
```

**Acceptance gates are LOCKED for Phase 2B exit.**
