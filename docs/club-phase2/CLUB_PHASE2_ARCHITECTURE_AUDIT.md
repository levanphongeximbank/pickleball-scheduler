# Club Management Phase 2A — Architecture Audit

**Status:** CLOSED — Phase 2A complete (documentation only)  
**Closed:** 2026-07-19  
**Branch:** `feature/club-phase-2a-architecture-audit`  
**Base:** `main` @ `553676e8f91c2f9dfd61837ba69e545815875880`  
**Next:** Phase 2B — Domain & API Freeze (docs only; see freeze pack below)

**Scope honored:** No application code, tests, SQL, migrations, Supabase, staging, production, deploy, push, or PR.

---

## Companion documents

### Phase 2A — Audit pack

| Document | Focus |
|----------|--------|
| [CLUB_DOMAIN_MODEL.md](./CLUB_DOMAIN_MODEL.md) | Entities, lifecycle, persistence |
| [CLUB_BOUNDARY_ANALYSIS.md](./CLUB_BOUNDARY_ANALYSIS.md) | Cross-module ownership |
| [CLUB_ROLE_MATRIX.md](./CLUB_ROLE_MATRIX.md) | Auth vs governance vs roster |
| [CLUB_API_AUDIT.md](./CLUB_API_AUDIT.md) | Public APIs, services, RPCs (as-built) |
| [CLUB_SECURITY_AUDIT.md](./CLUB_SECURITY_AUDIT.md) | RLS, RPC authz, isolation |
| [EVENT_OWNERSHIP_MATRIX.md](./EVENT_OWNERSHIP_MATRIX.md) | Business event owners / SoT |
| [READ_WRITE_OWNERSHIP.md](./READ_WRITE_OWNERSHIP.md) | Authoritative vs forbidden writers |
| [DEPENDENCY_DIAGRAM.md](./DEPENDENCY_DIAGRAM.md) | Allowed / forbidden dependencies |
| [CLUB_PHASE2_ROADMAP.md](./CLUB_PHASE2_ROADMAP.md) | Phase sequence (superseded detail in 2B sequence) |
| [CLUB_PHASE2_BACKLOG.md](./CLUB_PHASE2_BACKLOG.md) | Prioritized backlog |

### Phase 2B — Freeze pack (authoritative for implementation)

| Document | Focus |
|----------|--------|
| [CLUB_PHASE2_DOMAIN_FREEZE.md](./CLUB_PHASE2_DOMAIN_FREEZE.md) | Frozen Club-owned entities |
| [CLUB_PHASE2_API_FREEZE.md](./CLUB_PHASE2_API_FREEZE.md) | Frozen API surface |
| [CLUB_PHASE2_IMPORT_ALLOWLIST.md](./CLUB_PHASE2_IMPORT_ALLOWLIST.md) | Peer import rules |
| [CLUB_PHASE2_WRITER_POLICY.md](./CLUB_PHASE2_WRITER_POLICY.md) | Single-writer policy |
| [CLUB_PHASE2_IMPLEMENTATION_SEQUENCE.md](./CLUB_PHASE2_IMPLEMENTATION_SEQUENCE.md) | 2B→2H order |
| [CLUB_PHASE2_ACCEPTANCE_GATES.md](./CLUB_PHASE2_ACCEPTANCE_GATES.md) | GO/NO-GO gates |

---

## 1. Phase 2A closure verdict

| Item | Verdict |
|------|---------|
| Architecture rating | **6.5 / 10** (as-built dual-stack) |
| Ready for Phase 2B freeze? | **YES** |
| Ready for code/SQL without freeze? | **NO** |
| Production feature expansion on dual-write? | **NO** |

**Architecture verdict:** Club Management has a credible V2 cloud foundation (entity create/update certified; membership/governance RPCs present; Phase 1B/1C authz gates). Dual SSOT, blob kitchen-sink coupling, and missing Invitation / cloud Captain–Coach SoT block a higher rating. Phase 2 must freeze contracts first, then certify writers, then add GO product surfaces, then retire legacy.

---

## 2. Approved ownership model

| Concern | Owner | Club role |
|---------|-------|-----------|
| Club entity | **Club** | SoT writer |
| Membership edge | **Club** | SoT writer |
| Join request | **Club** | SoT writer |
| Invitation (outbound) | **Club** | SoT writer (Phase 2 — **GO**) |
| Governance (Owner/President/VP) | **Club** | SoT writer |
| Captain assignment | **Club** | SoT writer (Phase 2 — **GO**) |
| Coach assignment | **Club** | SoT writer (Phase 2 — **GO**) |
| Committee | — | **DEFER** — out of Phase 2 |
| Person / player profile | **Player** | Reference only |
| Rating / ranking | **Rating / Ranking** | Display/read only |
| Tournament / matchup | **Competition** | Roster eligibility read |
| Booking / court inventory | **Venue** | Cluster link reference only |
| Finance / notifications delivery | **Finance / Notification** | Ports only |

Detail: [CLUB_PHASE2_DOMAIN_FREEZE.md](./CLUB_PHASE2_DOMAIN_FREEZE.md).

---

## 3. Approved dependency graph

**Allowed (target):**

- Club → Player (read person), Notification (emit), Subscription (read limits)
- Competition → Club (read roster/governance refs), Player, Venue
- Ranking / AI → Club (read-only)
- Venue → Club (link references only; no Club blob writes after cutover)
- Player → Club (read membership references only; no membership writes)

**Forbidden:**

- Competition / Venue / Player / Ranking / AI / Notification writing Club SoT
- Club owning player profile, courts, bookings, tournaments, rating math, finance ledger
- Peer modules reading legacy club blob after cutover

Detail: [DEPENDENCY_DIAGRAM.md](./DEPENDENCY_DIAGRAM.md), [CLUB_PHASE2_IMPORT_ALLOWLIST.md](./CLUB_PHASE2_IMPORT_ALLOWLIST.md).

---

## 4. Owner product decisions (recorded)

| Capability | Decision | Phase 2 scope |
|------------|----------|---------------|
| **Invitation** | **GO** | Design + cloud SoT + APIs in Phase 2 (sequence 2E) |
| **Captain** | **GO** | Cloud roster assignment · cardinality **0..N** · optional primary · ship 2E (design 2C) |
| **Coach** | **GO** | Cloud roster assignment · cardinality **0..N** · no single-Coach · future specialization without replacing base model · ship 2E |
| **Committee** | **DEFER** | Explicit **exclusion** from Phase 2 implementation |

Roster title **Manager** (`CLUB_MEMBER_ROLES.MANAGER`) remains legacy/local wording only — **not** a Phase 2 cloud product surface unless a later Owner decision reopens it.

### Deferred decisions (recorded)

| Topic | Status | Target |
|-------|--------|--------|
| Invitation actor policy & invitee identity | Deferred | **Phase 2E** |
| Rating / Club Ratings ownership | Deferred | **Phase 2F** |
| Activity-schedule long-term ownership | Deferred | **Phase 2F** |

**Phase 2B status:** **LOCKED**. **Next implementation phase:** **2C** (membership certification). **No Phase 2 implementation code/SQL has started.**

---

## 5. Unresolved risks (carry into Phase 2B+)

| Risk | Severity | Mitigated by |
|------|----------|--------------|
| Dual SSOT (V2 vs extension/blob/registry) | High | Writer policy + 2C/2D/2G |
| Club blob kitchen sink | High | 2F boundary cutovers + 2G |
| Dual Elo / multi-rating | High | Boundary decision in 2F (not Club SoT) |
| `canonicalPlayerRepository` under Club | High | 2F move to Player |
| Phase 31 membership RPC client | Medium | 2C deprecate |
| Auth label `CLUB_OWNER` vs business Owner | Medium | Docs + UX copy later |
| Finance keyed by `clubId` | Medium | Finance track; Club non-owner |
| Create club already certified; membership/governance less so | Medium | 2C / 2D gates |
| Invitation actor / identity not locked | Medium | Defer to **2E** |
| Rating + activity-schedule ownership | Medium | Defer to **2F** |
| Invitation / Captain / Coach schema not yet in DB | High | 2E after freeze — SQL only with Owner GO |

---

## 6. Audit findings retained (summary)

**Strengths:** Governance model; V2 RPC write lock; 45A.3F create/update certification; 1B/1C authz; deliberate public barrel.

**Weaknesses:** Dual stack; blob coupling; local-only Captain/Coach; missing Invitation; multi-rating; misplaced player repos.

**As-built rating:** 6.5/10 — unchanged at Phase 2A close; target ≥8/10 after 2H.

---

## 7. Exit criteria — Phase 2A (met)

- [x] Architecture audit documents delivered  
- [x] Event / read-write / dependency matrices delivered  
- [x] Product GO/NO-GO recorded for Invitation, Captain, Coach, Committee  
- [x] No code/SQL/deploy/push/PR  
- [x] Hand-off to Phase 2B freeze pack  

**Phase 2A is CLOSED. Phase 2B Domain & API Freeze is LOCKED. Next: Phase 2C (implementation not started).**
