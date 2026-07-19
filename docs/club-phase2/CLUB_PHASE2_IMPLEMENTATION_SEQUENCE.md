# Club Phase 2 — Implementation Sequence

**Status:** FROZEN / **LOCKED** recommendation (documentation only)  
**Date:** 2026-07-19  
**Authority:** Phase 2B Domain & API Freeze  
**Phase status:** 2A CLOSED · 2B LOCKED · **2C IMPLEMENTED** (awaiting Owner gate) · **Next: 2D**  
**Product decisions:** Invitation GO · Captain/Coach GO (0..N; optional primary Captain) · Committee **EXCLUDED**

---

## 1. Sequence (approved)

```text
2B  Domain & API freeze              ← LOCKED (docs only)
 ↓
2C  Membership & roster parity       ← IMPLEMENTED (WS-A branch; Owner gate)
 ↓
2D  Governance writer certification  ← NEXT
 ↓
2E  Invitation + Captain/Coach SoT
 ↓
2F  Module boundary cutovers
 ↓
2G  Legacy writer / blob retirement
 ↓
2H  Final production certification
```

This matches repository evidence: create/update already certified (45A.3F); membership/governance still dual-path; Invitation/Captain/Coach have **no** cloud SoT yet; blob leaks are cross-module and should not block membership certification.

---

## 2. Why this order (safety rationale)

| Step | Why before the next |
|------|---------------------|
| **2B** | Prevents building Invite/Captain on undefined contracts |
| **2C** | Membership is the join spine; Invite accept and roster assign **require** stable membership writers |
| **2D** | Authz for Invite create and Captain assign depends on trustworthy governance roles |
| **2E** | New SoT only after writers/authz certified — avoids third parallel stack |
| **2F** | Boundary moves after Club core APIs stable — reduces rework |
| **2G** | Retire legacy only when replacements proven |
| **2H** | Production evidence after debt removed |

**Not chosen:** shipping Invitation before membership certification (would dual-write into unstable membership).  
**Not chosen:** Committee in Phase 2 (Owner DEFER).

---

## 3. Phase briefs

### 2B — Domain & API freeze (NOW)

| | |
|--|--|
| **Type** | Documentation only |
| **Exit** | Freeze docs accepted; no code/SQL |
| **Gates** | Architecture + product decisions recorded |

### 2C — Membership & roster parity

| | |
|--|--|
| **Type** | Code + tests; SQL only if membership gaps require (prefer certify existing RPCs first) |
| **Work** | Certify add/remove/restore/leave/review; hard-gate Phase 31 client; single active-membership path; **design** `club_roster_assignments` (no require ship UI yet) |
| **Exit** | 45A.3F-style membership certification doc |

### 2D — Governance writer certification

| | |
|--|--|
| **Type** | Code + tests; preserve Phase 1B/1C gates |
| **Work** | Single writer for owner/president/VP; block local SoT under V2 ON; clearPresident = transfer-only on active clubs |
| **Exit** | Governance certification doc; no authz regression |

### 2E — Invitation + Captain/Coach cloud SoT

| | |
|--|--|
| **Type** | SQL + RPC + app (Owner GO required for SQL apply) |
| **Work** | `club_invitations`; `club_roster_assignments` (Captain/Coach **0..N**; optional primary Captain); APIs per freeze; UI; notification events. Finalize invitation actor + identity. |
| **Exit** | Staging QA green; flag-compatible; no single-Captain/Coach enforcement |

### 2F — Module boundary cutovers

| | |
|--|--|
| **Type** | Code + docs across Club/Player/Competition/Venue |
| **Work** | Move canonical player repo; Competition ports; **Rating ownership decision**; **activity-schedule ownership decision**; Venue blob extraction **plan** |
| **Exit** | Import allow-list enforceable; no new blob SoT claims |

### 2G — Legacy retirement

| | |
|--|--|
| **Type** | Code + flag defaults |
| **Work** | Remove extension membership/role writers on V2; registry upsert dead; peer blob reads forbidden |
| **Exit** | Dual-write impossible on Production V2 builds |

### 2H — Final production certification

| | |
|--|--|
| **Type** | Evidence + preflight + smoke |
| **Work** | Full gate matrix; rollback notes; Owner GO for Production |
| **Exit** | Phase 2 CLOSED for Production |

---

## 4. Parallel tracks (allowed)

| Track | Parallel with | Constraint |
|-------|---------------|------------|
| Player Management repo move design | 2C–2D | No Club SoT change |
| Venue court extraction design | 2C–2E | No Club invite dependency |
| Notification event schema draft | 2D–2E | Consume-only |

---

## 5. Explicit non-goals until listed phase

| Item | Earliest |
|------|----------|
| Invitation SQL + actor/identity lock | 2E |
| Captain/Coach SQL (0..N + optional primary) | 2E |
| Committee | **Excluded** — Post–Phase 2 |
| Rating ownership decision | **2F** |
| Activity-schedule ownership decision | **2F** |
| Hard delete club | Post–2H unless emergency |

---

## 6. Relation to older roadmap doc

[CLUB_PHASE2_ROADMAP.md](./CLUB_PHASE2_ROADMAP.md) remains historical audit intent.  
**This file is authoritative** for Phase 2 implementation order after 2B freeze.

**Implementation sequence is LOCKED for Phase 2B exit.**
