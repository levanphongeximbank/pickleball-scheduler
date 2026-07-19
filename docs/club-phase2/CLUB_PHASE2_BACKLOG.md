# Club Phase 2 Backlog

**Status:** Prioritized backlog from Phase 2A audit + Phase 2B freeze  
**Product decisions:** Invitation **GO** · Captain/Coach **GO** (0..N; optional primary Captain) · Committee **EXCLUDED**  
**Phase status:** 2A CLOSED · 2B LOCKED · Next impl: **2C** (not started)  
**Legend:** P0 = do first · P1 = next · P2 = later · P3 = optional / deferred

---

## P0 — Foundations (block clean Phase 2)

| ID | Item | Type | Notes |
|----|------|------|-------|
| B-001 | Accept Phase 2A audit pack | Process | This folder |
| B-002 | Add `src/features/club/ARCHITECTURE.md` pointer | Docs | Phase 2B |
| B-003 | Freeze Production-legal write services | Docs | Entity / membership / governance |
| B-004 | Certify membership command plane (V2) | Arch / later code | Like 45A.3F |
| B-005 | Confirm Phase 1C owner gate remains Production baseline | Security | No regression |

---

## P1 — Dual-stack & API hygiene

| ID | Item | Type | Notes |
|----|------|------|-------|
| B-010 | Hard-gate / remove Phase 31 membership RPC client from V2 paths | API | Wrong signatures |
| B-011 | Stop exporting raw `rpcV2*` long-term (service façade only) | API | Phase 2B/2C |
| B-012 | Single active-membership resolution path | Domain | Deprecate `profiles.club_id` reads |
| B-013 | Document version-conflict + idempotency UX codes | API / UX | |
| B-014 | Peer-module import allow-list | Boundary | Competition, Player, Venue |

---

## P1 — Roster & governance completeness

| ID | Item | Type | Notes |
|----|------|------|-------|
| B-020 | ~~Decision: Captain/Coach~~ → **GO** · **0..N** · optional primary Captain | Product | Done (2B) |
| B-021 | Design V2 `club_roster_assignments` + authz (+ primary captain) | Domain | Phase 2C → ship 2E |
| B-022 | Certify governance writers (owner/VP/president) | Arch | Phase 2D |
| B-023 | Align ownership transfer UI with server assigner rules | Security / UX | |
| B-024 | Registration approve/reject fully on V2 path | Governance | |
| B-025 | Finalize invitation actor + identity | Product / Domain | **Phase 2E** |

---

## P1 — Boundaries

| ID | Item | Type | Notes |
|----|------|------|-------|
| B-030 | Move `canonicalPlayerRepository` to Player Management | Boundary | **Phase 2F** |
| B-031 | **Decision:** Club Ratings ownership | Product | **Deferred to Phase 2F** |
| B-032 | Remove dual Elo write on internal match completion | Rating | After B-031 (2F+) |
| B-033 | Club→Competition ports (`roster`, `onMatchCompleted`) | Boundary | |
| B-034 | Venue court/booking extraction plan from club blob | Boundary | Plan first |
| B-035 | Activity-schedule long-term ownership decision | Product | **Deferred to Phase 2F** |

---

## P2 — Product extensions

| ID | Item | Type | Notes |
|----|------|------|-------|
| B-040 | ~~GO/NO-GO Invitation~~ → **GO** recorded | Product | Done (2B) |
| B-041 | Design invitations (token, expiry, accept, authz) | Domain | Phase 2E |
| B-042 | ~~GO/NO-GO Committee~~ → **DEFER** | Product | Out of Phase 2 |
| B-043 | Committee design | Domain | Post–Phase 2 only |
| B-044 | Formal Notification port for club events | Boundary | |
| B-045 | Club announcements (if needed) | Product | Depends B-044 |

---

## P2 — Security & privacy follow-ups

| ID | Item | Type | Notes |
|----|------|------|-------|
| B-050 | Living RPC × role authz matrix | Security docs | |
| B-051 | Privacy review: platform athlete listing | Security | |
| B-052 | Privacy review: tournament invite member export | Security | |
| B-053 | Audit whitelist sync checklist for new RPCs | Security | |
| B-054 | Clarify `tenantId` vs `venueId` in all Club APIs | Isolation | |

---

## P3 — Legacy retirement & cleanup

| ID | Item | Type | Notes |
|----|------|------|-------|
| B-060 | Production default `VITE_CLUB_STORAGE_V2=true` | Cutover | |
| B-061 | Delete/disable legacy registry cloud writers | Cleanup | |
| B-062 | Stop writing `clubExtensionStorage.members` | Cleanup | |
| B-063 | Archive Phase 38–41 client helpers | Cleanup | |
| B-064 | Resolve auth label `CLUB_OWNER` vs business Owner | UX copy | |
| B-065 | Finance partition strategy (`tenant` vs `clubId`) | Boundary | With Finance |
| B-066 | Fix UI style dependency Club ← player pages | UI layering | |

---

## Explicit non-backlog (out of Club Phase 2 scope alone)

| Item | Owner track |
|------|-------------|
| Full court inventory migration | Venue & Court |
| Competition engine rewrite | Competition Core |
| Pick_VN / VPR algorithm changes | Rating programs |
| Subscription billing engine | Subscription |
| Production SQL apply without Owner GO | Ops / security phases |

---

## Suggested first sprint after 2A merge

1. B-001 → B-003 (docs freeze)  
2. B-020 + B-040 + B-042 (product decisions)  
3. B-004 design spike (membership certification plan)  
4. B-030 design spike (player repo move)  
5. B-031 rating decision workshop  

---

## Traceability

| Backlog theme | Audit doc |
|---------------|-----------|
| Domain gaps | `CLUB_DOMAIN_MODEL.md` |
| Boundaries | `CLUB_BOUNDARY_ANALYSIS.md` |
| Roles | `CLUB_ROLE_MATRIX.md` |
| APIs | `CLUB_API_AUDIT.md` |
| Security | `CLUB_SECURITY_AUDIT.md` |
| Sequencing | `CLUB_PHASE2_ROADMAP.md` |
| Executive | `CLUB_PHASE2_ARCHITECTURE_AUDIT.md` |
